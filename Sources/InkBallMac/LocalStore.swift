import Foundation
import ImageIO

enum StoreError: LocalizedError {
    case invalid(String)
    case missing

    var errorDescription: String? {
        switch self {
        case .invalid(let reason): return reason
        case .missing: return "Map not found."
        }
    }
}

final class LocalStore {
    let directory: URL
    private let profileURL: URL
    private let mapsURL: URL
    private let recordsURL: URL
    private let officialAchievements: [String: [String: [[String: Any]]]]

    init(directory: URL? = nil, officialAchievementsURL: URL? = nil) throws {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        self.directory = directory ?? support.appendingPathComponent("InkBall", isDirectory: true)
        profileURL = self.directory.appendingPathComponent("profile.json")
        mapsURL = self.directory.appendingPathComponent("maps.json")
        recordsURL = self.directory.appendingPathComponent("records.json")
        let catalogueURL = officialAchievementsURL ?? Bundle.main.resourceURL?.appendingPathComponent("Web/official-achievements.json")
        if let catalogueURL, FileManager.default.fileExists(atPath: catalogueURL.path) {
            let data = try Data(contentsOf: catalogueURL)
            guard let catalogue = try JSONSerialization.jsonObject(with: data) as? [String: [String: [[String: Any]]]] else {
                throw StoreError.invalid("Official achievements are damaged.")
            }
            officialAchievements = catalogue
        } else {
            officialAchievements = [:]
        }
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
    }

    private func readObject(_ url: URL) throws -> [String: Any]? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let data = try Data(contentsOf: url)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw StoreError.invalid("Stored data is damaged: \(url.lastPathComponent)")
        }
        return object
    }

    private func writeObject(_ object: [String: Any], to url: URL) throws {
        let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        try data.write(to: url, options: .atomic)
    }

    func profile() throws -> [String: Any] {
        if var saved = try readObject(profileURL) {
            // Older installs stored keys for bundled character artwork. That
            // catalogue is no longer shipped, so migrate those profiles.
            if saved["avatar"] as? String != "custom" || (saved["avatarData"] as? String ?? "").isEmpty {
                if saved["avatar"] as? String != "default" || saved["avatarData"] as? String != "" {
                    saved["avatar"] = "default"
                    saved["avatarData"] = ""
                    try writeObject(saved, to: profileURL)
                }
            }
            if saved["detailTransparency"] == nil {
                saved["detailTransparency"] = 20
                try writeObject(saved, to: profileURL)
            }
            return saved
        }
        let generated: [String: Any] = [
            "id": UUID().uuidString,
            "name": "player\(Int.random(in: 100_000...999_999))",
            "avatar": "default",
            "avatarData": "",
            "language": "zh",
            "detailTransparency": 20,
        ]
        try writeObject(generated, to: profileURL)
        return generated
    }

    func updateProfile(name: String, avatarData: String, detailTransparency: Int? = nil) throws -> [String: Any] {
        if let detailTransparency, !(0...100).contains(detailTransparency) {
            throw StoreError.invalid("Difficulty screen transparency must be between 0 and 100.")
        }
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, clean.count <= 50 else {
            throw StoreError.invalid("Player name must contain 1–50 characters.")
        }
        if !avatarData.isEmpty {
            let prefix = "data:image/jpeg;base64,"
            guard avatarData.hasPrefix(prefix),
                  let bytes = Data(base64Encoded: String(avatarData.dropFirst(prefix.count))),
                  bytes.count <= 16_384,
                  let source = CGImageSourceCreateWithData(bytes as CFData, nil),
                  CGImageSourceGetType(source) as String? == "public.jpeg",
                  let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
                  properties[kCGImagePropertyPixelWidth as String] as? Int == 96,
                  properties[kCGImagePropertyPixelHeight as String] as? Int == 96,
                  CGImageSourceCreateImageAtIndex(source, 0, nil) != nil else {
                throw StoreError.invalid("Avatar must be a cropped 96 × 96 JPEG under 16 KB.")
            }
        }
        var value = try profile()
        value["name"] = clean
        value["avatar"] = avatarData.isEmpty ? "default" : "custom"
        value["avatarData"] = avatarData
        if let detailTransparency { value["detailTransparency"] = detailTransparency }
        try writeObject(value, to: profileURL)
        return value
    }

    func updateLanguage(_ language: String) throws -> [String: Any] {
        guard language == "zh" || language == "en" else { throw StoreError.invalid("Unsupported language.") }
        var value = try profile()
        value["language"] = language
        try writeObject(value, to: profileURL)
        return value
    }

    func maps() throws -> [[String: Any]] {
        let envelope = try readObject(mapsURL) ?? ["version": 1, "maps": []]
        guard let rows = envelope["maps"] as? [[String: Any]] else {
            throw StoreError.invalid("Stored maps are damaged.")
        }
        return rows
    }

    func map(id: String) throws -> [String: Any] {
        guard let row = try maps().first(where: { $0["id"] as? String == id }) else {
            throw StoreError.missing
        }
        return row
    }

    func saveMap(_ raw: [String: Any]) throws -> [String: Any] {
        try saveMap(raw, allowOfficialBorder: false)
    }

    private func saveMap(_ raw: [String: Any], allowOfficialBorder: Bool) throws -> [String: Any] {
        var candidate = try Self.validateMap(raw, allowOfficialBorder: allowOfficialBorder)
        var all = try maps()
        let id = (raw["id"] as? String).flatMap(UUID.init(uuidString:))?.uuidString ?? UUID().uuidString
        candidate["id"] = id
        candidate["official"] = false
        let timestamp = ISO8601DateFormatter()
        timestamp.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        candidate["updatedAt"] = timestamp.string(from: Date())
        if let index = all.firstIndex(where: { $0["id"] as? String == id }) {
            all[index] = candidate
        } else {
            all.append(candidate)
        }
        try writeObject(["version": 1, "maps": all], to: mapsURL)
        return candidate
    }

    func deleteMap(id: String) throws {
        let all = try maps()
        let kept = all.filter { $0["id"] as? String != id }
        guard kept.count < all.count else { throw StoreError.missing }
        try writeObject(["version": 1, "maps": kept], to: mapsURL)
    }

    func exportCode(id: String) throws -> String {
        var value = try map(id: id)
        value.removeValue(forKey: "id")
        value.removeValue(forKey: "updatedAt")
        value["official"] = false
        return try Self.encodeCode(value)
    }

    func exportCode(officialMap: [String: Any]) throws -> String {
        guard officialMap["official"] as? Bool == true else {
            throw StoreError.invalid("Expected an official map.")
        }
        _ = try Self.validateMap(officialMap, allowOfficialBorder: true)
        return try Self.encodeCode(officialMap)
    }

    func exportDifficultyCode(level: [String: Any], author: String) throws -> String {
        var normalized = try Self.validateSharedLevel(level)
        var history = normalized["author_history"] as? [String] ?? []
        let currentAuthor = String(author.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
        if !currentAuthor.isEmpty && history.last != currentAuthor { history.append(currentAuthor) }
        if history.isEmpty { history = ["Spherail"] }
        normalized["author_history"] = history
        let payload: [String: Any] = [
            "format": "inkball-map", "version": 2,
            "layout": normalized["layout_content"] ?? "",
            "balls": normalized["balls"] ?? [],
            "serve_interval": normalized["spawn_interval"] ?? 0,
            "total_time": normalized["time"] ?? 0,
            "author_history": history,
        ]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys, .prettyPrinted])
        return "INKBALL-LEVEL/1\n" + String(decoding: data, as: UTF8.self)
    }

    func importDifficultyCode(_ code: String) throws -> [String: Any] {
        let prefix = "INKBALL-LEVEL/1\n"
        guard code.utf8.count <= 100_000, code.hasPrefix(prefix),
              let payload = try JSONSerialization.jsonObject(with: Data(code.dropFirst(prefix.count).utf8)) as? [String: Any],
              payload["format"] as? String == "inkball-map",
              payload["version"] as? Int == 2 else {
            throw StoreError.invalid("Invalid difficulty code.")
        }
        let level: [String: Any] = [
            "layout_content": payload["layout"] ?? "",
            "balls": payload["balls"] ?? [],
            "spawn_interval": payload["serve_interval"] ?? -1,
            "time": payload["total_time"] ?? 0,
            "author_history": payload["author_history"] ?? [],
        ]
        return try Self.validateSharedLevel(level)
    }

    private static func validateSharedLevel(_ level: [String: Any]) throws -> [String: Any] {
        let history = level["author_history"] as? [String] ?? []
        guard let layout = level["layout_content"] as? String,
              let balls = level["balls"] as? [String], balls.count <= 200,
              balls.allSatisfy(Set(["grey", "orange", "blue", "green", "yellow"]).contains),
              let interval = level["spawn_interval"] as? Int, (0...600).contains(interval),
              let time = level["time"] as? Int, (1...3600).contains(time),
              history.count <= 50, history.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.count <= 100 }) else {
            throw StoreError.invalid("Invalid difficulty data.")
        }
        let rows = layout.replacingOccurrences(of: "\r\n", with: "\n")
            .split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        guard rows.count == 18, rows.allSatisfy({ $0.count == 36 }) else {
            throw StoreError.invalid("A difficulty must have 18 rows of 18 two-character cells.")
        }
        let allowed = Set("XHSBU DLRudlrCYVGKT A1234abcefhijkmnopqstvwx y".filter { $0 != " " })
        var normalized = rows
        for y in 0..<18 {
            var characters = Array(rows[y])
            for x in 0..<18 {
                let index = x * 2
                let token = characters[index]
                let attribute = characters[index + 1]
                guard token == " " || allowed.contains(token) else {
                    throw StoreError.invalid("Unknown difficulty tile.")
                }
                if token == "B" || token == "H" {
                    guard let color = attribute.wholeNumberValue, (0...4).contains(color) else {
                        throw StoreError.invalid("Invalid ball or hole colour.")
                    }
                }
                if y == 0 || y == 17 || x == 0 || x == 17 {
                    characters[index] = "X"
                    characters[index + 1] = " "
                }
            }
            normalized[y] = String(characters)
        }
        return ["layout_content": normalized.joined(separator: "\n"), "layout": "custom.txt",
                "balls": balls, "spawn_interval": interval, "time": time, "author_history": history]
    }

    private static func encodeCode(_ value: [String: Any]) throws -> String {
        let envelope: [String: Any] = ["format": "INKBALL-MAP", "version": 1, "map": value]
        let data = try JSONSerialization.data(withJSONObject: envelope, options: [.sortedKeys, .prettyPrinted, .fragmentsAllowed])
        guard let text = String(data: data, encoding: .utf8) else { throw StoreError.invalid("Unable to encode map.") }
        return "INKBALL-MAP/1\n" + text
    }

    func importCode(_ code: String) throws -> [String: Any] {
        guard code.utf8.count <= 200_000, code.hasPrefix("INKBALL-MAP/1\n") else {
            throw StoreError.invalid("Invalid or oversized map code.")
        }
        let body = String(code.dropFirst("INKBALL-MAP/1\n".count))
        guard let object = try JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any],
              object["format"] as? String == "INKBALL-MAP",
              (object["version"] as? Int) == 1,
              let raw = object["map"] as? [String: Any] else {
            throw StoreError.invalid("Invalid map code.")
        }
        let allowOfficialBorder = raw["official"] as? Bool == true
        var fresh = try Self.validateMap(raw, allowOfficialBorder: allowOfficialBorder)
        let existing = try maps()
        let importedName = fresh["name"] as? String ?? ""
        func variantName(_ number: Int) -> String {
            let suffix = " (\(number))"
            return String(importedName.prefix(max(0, 20 - suffix.count))) + suffix
        }
        let variantNames = Set((2...(existing.count + 2)).map(variantName))
        let payload = try JSONSerialization.data(withJSONObject: fresh, options: [.sortedKeys])
        for map in existing {
            var comparable = map
            comparable.removeValue(forKey: "id")
            comparable.removeValue(forKey: "updatedAt")
            if let name = comparable["name"] as? String, variantNames.contains(name) {
                comparable["name"] = importedName
            }
            guard let data = try? JSONSerialization.data(withJSONObject: comparable, options: [.sortedKeys]) else { continue }
            if data == payload { return map }
        }
        let names = Set(existing.compactMap { $0["name"] as? String })
        if names.contains(importedName) {
            var suffixNumber = 2
            while true {
                let candidateName = variantName(suffixNumber)
                if !names.contains(candidateName) {
                    fresh["name"] = candidateName
                    break
                }
                suffixNumber += 1
            }
        }
        return try saveMap(fresh, allowOfficialBorder: allowOfficialBorder)
    }

    static func validateMap(_ raw: [String: Any], allowOfficialBorder: Bool = false) throws -> [String: Any] {
        let name = (raw["name"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name.count <= 20 else { throw StoreError.invalid("Map name must contain 1–20 characters.") }
        guard let levels = raw["difficulties"] as? [String: [String: Any]], !levels.isEmpty else {
            throw StoreError.invalid("At least one difficulty is required.")
        }
        var cleaned: [String: [String: Any]] = [:]
        var authoredCount = 0
        let colorSet: Set<String> = ["grey", "orange", "blue", "green", "yellow"]
        let tileSet = Set("XHSBU DLRudlrCYVGKT A1234abcefhijkmnopqstvwx y".filter { $0 != " " })
        for (difficulty, level) in levels {
            guard ["easy", "hard", "master"].contains(difficulty) else { throw StoreError.invalid("Unknown difficulty.") }
            guard let layout = level["layout_content"] as? String ?? level["layout"] as? String else {
                throw StoreError.invalid("Missing layout.")
            }
            let rows = layout.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false)
            guard rows.count == 18, rows.allSatisfy({ $0.count == 36 }) else {
                throw StoreError.invalid("A map must have 18 rows of 18 two-character cells.")
            }
            var placedBalls: [String] = []
            var holes = Set<Int>()
            var recolourWalls = Set<Int>()
            var hasInteriorTiles = false
            var hasSpawner = false
            for (rowIndex, row) in rows.enumerated() {
                let chars = Array(row)
                for index in stride(from: 0, to: 36, by: 2) {
                    guard chars[index] == " " || tileSet.contains(chars[index]) else {
                        throw StoreError.invalid("Unknown map tile.")
                    }
                    let column = index / 2
                    let token = chars[index]
                    let attr = chars[index + 1]
                    if rowIndex == 0 || rowIndex == 17 || column == 0 || column == 17 {
                        let officialColourWall = allowOfficialBorder && (1...4).contains(token.wholeNumberValue ?? -1)
                        guard token == "X" || officialColourWall else {
                            throw StoreError.invalid("The outside border must be walls.")
                        }
                    } else if token != " " {
                        hasInteriorTiles = true
                    }
                    if token == "S" { hasSpawner = true }
                    if token == "B" || token == "H" {
                        guard let color = attr.wholeNumberValue, (0...4).contains(color) else {
                            throw StoreError.invalid("Balls and holes need a valid colour.")
                        }
                        if token == "B" { placedBalls.append(["grey", "orange", "blue", "green", "yellow"][color]) }
                        else { holes.insert(color) }
                    }
                    if let color = token.wholeNumberValue, (1...4).contains(color) { recolourWalls.insert(color) }
                }
            }
            let time = level["time"] as? Int ?? 0
            let interval = level["spawn_interval"] as? Int ?? 0
            guard (1...3600).contains(time), (0...600).contains(interval) else {
                throw StoreError.invalid("Invalid time or spawn interval.")
            }
            let balls = level["balls"] as? [String] ?? []
            guard balls.count <= 200, balls.allSatisfy(colorSet.contains) else {
                throw StoreError.invalid("Invalid ball queue.")
            }
            guard time >= balls.count * interval else {
                throw StoreError.invalid("Total time must be at least serve count times the interval.")
            }
            if hasInteriorTiles || !balls.isEmpty {
                authoredCount += 1
                let allBalls = balls + placedBalls
                guard !allBalls.isEmpty else { throw StoreError.invalid("\(difficulty): At least one ball is required.") }
                guard balls.isEmpty || hasSpawner else {
                    throw StoreError.invalid("\(difficulty): A ball queue requires at least one spawn point.")
                }
                guard !holes.isEmpty else { throw StoreError.invalid("\(difficulty): At least one hole is required.") }
                for color in Set(allBalls) {
                    guard let index = ["grey", "orange", "blue", "green", "yellow"].firstIndex(of: color) else { continue }
                    if index > 0 && !holes.contains(0) && !holes.contains(index) && !recolourWalls.contains(index) {
                        throw StoreError.invalid("\(difficulty): \(color) balls need a matching hole, grey hole, or matching colour wall.")
                    }
                }
            }
            var normalized = level
            normalized["layout_content"] = rows.joined(separator: "\n")
            normalized["layout"] = "custom_\(difficulty).txt"
            normalized["time"] = time
            normalized["spawn_interval"] = interval
            normalized["balls"] = balls
            cleaned[difficulty] = normalized
        }
        guard authoredCount > 0 else { throw StoreError.invalid("At least one ball and one hole are required.") }
        let author = String((raw["author"] as? String ?? "").prefix(100))
        return ["name": name, "author": author, "difficulties": cleaned, "official": false]
    }

    func recordResult(mapID: String, difficulty: String, score: Int, cleared: Bool, duration: Int,
                      correct: Int = 0, wrong: Int = 0, lines: Int = 0) throws -> [String: Any] {
        var envelope = try readObject(recordsURL) ?? ["version": 1, "records": [:]]
        var records = envelope["records"] as? [String: [String: Any]] ?? [:]
        let key = "\(mapID)|\(difficulty)"
        let oldBest = records[key]?["bestScore"] as? Int ?? 0
        let newRecord = score > oldBest
        let best = max(oldBest, score)
        var item = records[key] ?? [:]
        let attemptsExist = item["lastScore"] != nil
        let previousTime = item["bestTime"] as? Int ?? item["lastDuration"] as? Int
        let totalCaptures = max(0, correct) + max(0, wrong)
        let accuracy = totalCaptures == 0 ? 0 : Int((Double(max(0, correct)) / Double(totalCaptures) * 100).rounded())
        let previousAccuracy = item["bestAccuracy"] as? Int
        let previousClears = item["clears"] as? Int
        let knownLegacyClears = (item["lastCleared"] as? Bool == true) ? 1 : 0
        item["bestScore"] = best
        item["bestTime"] = min(previousTime ?? duration, duration)
        item["bestAccuracy"] = max(previousAccuracy ?? accuracy, accuracy)
        item["clears"] = (previousClears ?? knownLegacyClears) + (cleared ? 1 : 0)
        if attemptsExist && previousClears == nil { item["clearsApproximate"] = true }
        item["lastScore"] = score
        item["lastCleared"] = cleared
        item["lastDuration"] = duration
        item["lastAccuracy"] = accuracy
        records[key] = item
        envelope["records"] = records
        var unlocked = envelope["achievements"] as? [String: String] ?? [:]
        var newlyUnlocked: [String] = []
        if cleared {
            let definitions = (officialAchievements[mapID]?[difficulty] ?? []).sorted {
                ($0["display_order"] as? Int ?? 0) < ($1["display_order"] as? Int ?? 0)
            }
            for definition in definitions {
                guard let code = definition["code"] as? String, unlocked[code] == nil else { continue }
                let target = definition["target"] as? Int ?? 0
                let earned: Bool
                switch definition["criterion"] as? String {
                case "clear": earned = true
                case "score_at_least": earned = score >= target
                case "no_wrong_captures": earned = wrong == 0
                case "max_duration_seconds": earned = duration <= target
                case "max_lines_drawn": earned = lines <= target
                default: earned = false
                }
                if earned {
                    unlocked[code] = ISO8601DateFormatter().string(from: Date())
                    newlyUnlocked.append(code)
                }
            }
        }
        envelope["achievements"] = unlocked
        try writeObject(envelope, to: recordsURL)
        item["newRecord"] = newRecord
        item["newlyUnlocked"] = newlyUnlocked
        return item
    }

    func achievements() throws -> [String: Bool] {
        let unlocked = try readObject(recordsURL)?["achievements"] as? [String: String] ?? [:]
        return unlocked.mapValues { _ in true }
    }

    func records() throws -> [String: Any] {
        return try readObject(recordsURL)?["records"] as? [String: Any] ?? [:]
    }
}
