import Foundation

struct NearbyPeerPresence {
    enum Transport: String { case wifi, bluetooth }
    let transport: Transport
    let endpointID: String
    let playerID: String?
    let name: String
    let deviceName: String
    let avatar: String?
    let rssi: Int?

    var identity: String {
        guard let playerID, !playerID.isEmpty else { return "\(transport.rawValue):\(endpointID)" }
        return "player:\(Self.shortID(playerID))"
    }

    static func shortID(_ id: String) -> String {
        String(id.replacingOccurrences(of: "-", with: "").lowercased().prefix(8))
    }
}

enum NearbyPeerDirectory {
    /// macOS may omit the advertised BLE local name when the service UUID fills
    /// the packet. In that case Core Bluetooth reports the Mac's system name.
    /// Resolve it only when that name identifies exactly one peer on each link.
    static func resolved(_ presences: [NearbyPeerPresence]) -> [NearbyPeerPresence] {
        let wifi = presences.filter { $0.transport == .wifi }
        let bluetooth = presences.filter { $0.transport == .bluetooth }
        func deviceKey(_ name: String) -> String {
            name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        }
        return presences.map { presence in
            guard presence.transport == .bluetooth,
                  presence.playerID == nil || presence.playerID?.isEmpty == true else { return presence }
            let key = deviceKey(presence.deviceName)
            guard !key.isEmpty, key != "mac", key != "inkball mac", key != "spherail mac",
                  wifi.filter({ deviceKey($0.deviceName) == key }).count == 1,
                  bluetooth.filter({ deviceKey($0.deviceName) == key }).count == 1,
                  let match = wifi.first(where: { deviceKey($0.deviceName) == key }) else { return presence }
            return NearbyPeerPresence(transport: .bluetooth, endpointID: presence.endpointID,
                playerID: match.playerID, name: presence.name, deviceName: presence.deviceName,
                avatar: presence.avatar, rssi: presence.rssi)
        }
    }

    static func merged(_ presences: [NearbyPeerPresence]) -> [[String: Any]] {
        let groups = Dictionary(grouping: resolved(presences), by: \.identity)
        return groups.values.compactMap { group -> [String: Any]? in
            guard let chosen = group.first(where: { $0.transport == .wifi }) ?? group.first else { return nil }
            let bluetooth = group.first(where: { $0.transport == .bluetooth })
            let wifi = group.first(where: { $0.transport == .wifi })
            let transportName = wifi == nil ? "蓝牙" : bluetooth == nil ? "Wi-Fi" : "Wi-Fi + 蓝牙"
            return [
                "id": "\(chosen.transport.rawValue):\(chosen.endpointID)",
                "playerID": chosen.playerID ?? "",
                "name": chosen.name,
                "deviceName": chosen.deviceName,
                "avatar": chosen.avatar ?? "",
                "rssi": bluetooth?.rssi as Any? ?? NSNull(),
                "transport": transportName,
                "hasWiFi": wifi != nil,
                "hasBluetooth": bluetooth != nil,
            ]
        }.sorted { ($0["name"] as? String ?? "") < ($1["name"] as? String ?? "") }
    }
}

enum MatchTransportSelector {
    /// Wi-Fi carries large board snapshots efficiently. Prefer Bluetooth only
    /// when recent measurements show a clear latency advantage.
    static func preferred(hasWiFi: Bool, hasBluetooth: Bool,
                          wifiRTT: Int?, bluetoothRTT: Int?) -> NearbyPeerPresence.Transport? {
        if !hasWiFi { return hasBluetooth ? .bluetooth : nil }
        guard hasBluetooth, let wifiRTT, let bluetoothRTT else { return .wifi }
        return bluetoothRTT + 20 < Int(Double(wifiRTT) * 0.85) ? .bluetooth : .wifi
    }
}
