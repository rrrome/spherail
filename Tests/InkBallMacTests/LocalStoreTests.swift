import AppKit
import Foundation
import XCTest
@testable import InkBallMac

final class LocalStoreTests: XCTestCase {
    private func temporaryStore() throws -> LocalStore {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        return try LocalStore(directory: directory)
    }

    private func sampleMap() -> [String: Any] {
        var rows: [String] = []
        for y in 0..<18 {
            var cells: [String] = []
            for x in 0..<18 {
                cells.append(x == 0 || x == 17 || y == 0 || y == 17 ? "X " : x == 4 && y == 4 ? "H0" : x == 2 && y == 2 ? "S " : "  ")
            }
            rows.append(cells.joined())
        }
        let layout = rows.joined(separator: "\n")
        return ["name": "Test Map", "author": "player142425", "difficulties": [
            "easy": ["layout_content": layout, "time": 100, "spawn_interval": 4, "balls": ["grey"]]
        ]]
    }

    func testProfileIsCreatedOnceAndCanBeEdited() throws {
        let store = try temporaryStore()
        let first = try store.profile()
        XCTAssertTrue((first["name"] as? String ?? "").hasPrefix("player"))
        XCTAssertEqual((first["name"] as? String ?? "").count, 12)
        XCTAssertEqual(first["avatar"] as? String, "default")
        XCTAssertEqual(first["avatarData"] as? String, "")
        XCTAssertEqual(first["id"] as? String, try store.profile()["id"] as? String)
        XCTAssertEqual(first["language"] as? String, "zh")
        XCTAssertEqual(try store.updateLanguage("en")["language"] as? String, "en")
        XCTAssertEqual(try store.profile()["language"] as? String, "en")
        XCTAssertThrowsError(try store.updateLanguage("fr"))
        let changed = try store.updateProfile(name: "  Alice  ", avatarData: "")
        XCTAssertEqual(changed["name"] as? String, "Alice")
        XCTAssertEqual(try store.profile()["avatar"] as? String, "default")
        XCTAssertThrowsError(try store.updateProfile(name: "", avatarData: ""))
        XCTAssertThrowsError(try store.updateProfile(name: "Alice", avatarData: "unknown"))
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 96, pixelsHigh: 96,
                                      bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                      isPlanar: false, colorSpaceName: .deviceRGB,
                                      bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        NSColor.systemTeal.setFill()
        NSBezierPath(rect: CGRect(x: 0, y: 0, width: 96, height: 96)).fill()
        NSGraphicsContext.restoreGraphicsState()
        let jpeg = try XCTUnwrap(bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.7]))
        let avatarData = "data:image/jpeg;base64," + jpeg.base64EncodedString()
        let custom = try store.updateProfile(name: "Alice", avatarData: avatarData)
        XCTAssertEqual(custom["avatar"] as? String, "custom")
        XCTAssertEqual(try store.profile()["avatarData"] as? String, avatarData)
        XCTAssertEqual(try store.updateProfile(name: "Alice", avatarData: "")["avatar"] as? String, "default")
    }

    func testDetailTransparencyPersistsAndValidatesRange() throws {
        let store = try temporaryStore()
        XCTAssertEqual(try store.profile()["detailTransparency"] as? Int, 20)
        for value in [0, 35, 100] {
            _ = try store.updateProfile(name: "Alice", avatarData: "", detailTransparency: value)
            let reopened = try LocalStore(directory: store.directory)
            XCTAssertEqual(try reopened.profile()["detailTransparency"] as? Int, value)
        }
        XCTAssertThrowsError(try store.updateProfile(name: "Alice", avatarData: "", detailTransparency: -1))
        XCTAssertThrowsError(try store.updateProfile(name: "Alice", avatarData: "", detailTransparency: 101))
        _ = try store.updateProfile(name: "Bob", avatarData: "")
        _ = try store.updateLanguage("en")
        XCTAssertEqual(try store.profile()["detailTransparency"] as? Int, 100)
    }

    func testLegacyBundledAvatarMigratesToDefault() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let old: [String: Any] = ["id": "saved-player", "name": "Alice",
                                  "avatar": "genshin-001", "language": "en"]
        let data = try JSONSerialization.data(withJSONObject: old)
        try data.write(to: directory.appendingPathComponent("profile.json"))
        let store = try LocalStore(directory: directory)
        let migrated = try store.profile()
        XCTAssertEqual(migrated["id"] as? String, "saved-player")
        XCTAssertEqual(migrated["name"] as? String, "Alice")
        XCTAssertEqual(migrated["language"] as? String, "en")
        XCTAssertEqual(migrated["avatar"] as? String, "default")
        XCTAssertEqual(migrated["avatarData"] as? String, "")
        XCTAssertEqual(migrated["detailTransparency"] as? Int, 20)
        XCTAssertEqual(try store.profile()["avatar"] as? String, "default")
    }

    func testMapRoundTripAndResultPersistence() throws {
        let store = try temporaryStore()
        let saved = try store.saveMap(sampleMap())
        let id = try XCTUnwrap(saved["id"] as? String)
        let layout = (saved["difficulties"] as? [String: [String: Any]])?["easy"]?["layout_content"] as? String
        XCTAssertTrue(layout?.contains("S ") ?? false)
        XCTAssertTrue(layout?.contains("H0") ?? false)
        XCTAssertEqual(try store.map(id: id)["name"] as? String, "Test Map")
        let imported = try store.importCode(store.exportCode(id: id))
        XCTAssertEqual(imported["id"] as? String, id)
        XCTAssertEqual(try store.maps().count, 1)
        _ = try store.recordResult(mapID: id, difficulty: "easy", score: 100,
                                   cleared: true, duration: 20)
        let record = try store.recordResult(mapID: id, difficulty: "easy", score: 50,
                                            cleared: false, duration: 30)
        XCTAssertEqual(record["bestScore"] as? Int, 100)
        try store.deleteMap(id: id)
        XCTAssertEqual(try store.maps().count, 0)
    }

    func testImportWithSameNameAndDifferentContentGetsDistinctName() throws {
        let store = try temporaryStore()
        var variant = sampleMap()
        var levels = try XCTUnwrap(variant["difficulties"] as? [String: [String: Any]])
        levels["easy"]?["time"] = 120
        variant["difficulties"] = levels
        let source = try store.saveMap(variant)
        let code = try store.exportCode(id: try XCTUnwrap(source["id"] as? String))
        try store.deleteMap(id: try XCTUnwrap(source["id"] as? String))
        _ = try store.saveMap(sampleMap())
        let imported = try store.importCode(code)
        XCTAssertEqual(imported["name"] as? String, "Test Map (2)")
        XCTAssertEqual(try store.maps().count, 2)
        XCTAssertEqual(try store.importCode(code)["id"] as? String, imported["id"] as? String)
        XCTAssertEqual(try store.maps().count, 2)
    }

    func testDifficultyCodeCopiesOnlyOneLevelAndHasNoMapIdentity() throws {
        let store = try temporaryStore()
        let source = sampleMap()
        let level = try XCTUnwrap((source["difficulties"] as? [String: [String: Any]])?["easy"])
        let code = try store.exportDifficultyCode(level: level, author: "player142425")
        XCTAssertTrue(code.hasPrefix("INKBALL-LEVEL/1\n"))
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(code.dropFirst("INKBALL-LEVEL/1\n".count).utf8)) as? [String: Any])
        XCTAssertEqual(body["format"] as? String, "inkball-map")
        XCTAssertNil(body["name"])
        XCTAssertNil(body["difficulty"])
        XCTAssertNil(body["difficulties"])
        XCTAssertEqual(body["author_history"] as? [String], ["player142425"])
        let imported = try store.importDifficultyCode(code)
        XCTAssertEqual(imported["layout_content"] as? String, level["layout_content"] as? String)
        XCTAssertEqual(imported["balls"] as? [String], ["grey"])
        XCTAssertEqual(imported["time"] as? Int, 100)
        var destination = source
        var levels = try XCTUnwrap(destination["difficulties"] as? [String: [String: Any]])
        levels["hard"] = imported
        destination["difficulties"] = levels
        let saved = try store.saveMap(destination)
        let savedLevels = try XCTUnwrap(saved["difficulties"] as? [String: [String: Any]])
        XCTAssertEqual(savedLevels["easy"]?["layout_content"] as? String, savedLevels["hard"]?["layout_content"] as? String)
        XCTAssertEqual(try store.maps().count, 1)
        XCTAssertThrowsError(try store.importDifficultyCode("INKBALL-MAP/1\n{}"))
    }

    func testBestRecordAggregatesIndependentScoreTimeAccuracyAndClears() throws {
        let store = try temporaryStore()
        let first = try store.recordResult(mapID: "showcase", difficulty: "easy", score: 100,
                                           cleared: true, duration: 20, correct: 2)
        XCTAssertEqual(first["bestTime"] as? Int, 20)
        XCTAssertEqual(first["bestAccuracy"] as? Int, 100)
        XCTAssertEqual(first["clears"] as? Int, 1)
        let failed = try store.recordResult(mapID: "showcase", difficulty: "easy", score: 50,
                                            cleared: false, duration: 15, correct: 1, wrong: 3)
        XCTAssertEqual(failed["bestScore"] as? Int, 100)
        XCTAssertEqual(failed["bestTime"] as? Int, 15)
        XCTAssertEqual(failed["bestAccuracy"] as? Int, 100)
        XCTAssertEqual(failed["clears"] as? Int, 1)
        let last = try store.recordResult(mapID: "showcase", difficulty: "easy", score: 120,
                                          cleared: true, duration: 30, correct: 3, wrong: 1)
        XCTAssertEqual(last["bestScore"] as? Int, 120)
        XCTAssertEqual(last["bestTime"] as? Int, 15)
        XCTAssertEqual(last["bestAccuracy"] as? Int, 100)
        XCTAssertEqual(last["clears"] as? Int, 2)
        let saved = try XCTUnwrap(store.records()["showcase|easy"] as? [String: Any])
        XCTAssertEqual(saved["clears"] as? Int, 2)
        XCTAssertNil(saved["clearsApproximate"])
    }

    func testLegacyResultKeepsKnownBestAndMarksUnknownClearHistory() throws {
        let store = try temporaryStore()
        let path = store.directory.appendingPathComponent("records.json")
        let legacy: [String: Any] = ["version": 1, "records": ["showcase|easy": [
            "bestScore": 500, "lastScore": 500, "lastDuration": 20, "lastCleared": true
        ]]]
        try JSONSerialization.data(withJSONObject: legacy).write(to: path)
        let updated = try store.recordResult(mapID: "showcase", difficulty: "easy", score: 100,
                                              cleared: false, duration: 40, correct: 1, wrong: 1)
        XCTAssertEqual(updated["bestScore"] as? Int, 500)
        XCTAssertEqual(updated["bestTime"] as? Int, 20)
        XCTAssertEqual(updated["bestAccuracy"] as? Int, 50)
        XCTAssertEqual(updated["clears"] as? Int, 1)
        XCTAssertEqual(updated["clearsApproximate"] as? Bool, true)
    }

    func testEveryOfficialMapCodeImportsAsAnEditableCopy() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let source = try String(contentsOf: root.appendingPathComponent("Web/official-data.js"), encoding: .utf8)
        let prefix = "window.INKBALL_OFFICIAL="
        XCTAssertTrue(source.hasPrefix(prefix))
        let body = source.dropFirst(prefix.count).trimmingCharacters(in: CharacterSet(charactersIn: ";\n "))
        let catalog = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        let maps = try XCTUnwrap(catalog["maps"] as? [[String: Any]])
        let store = try temporaryStore()
        for map in maps {
            let code = try store.exportCode(officialMap: map)
            let copy = try store.importCode(code)
            XCTAssertEqual(copy["name"] as? String, map["name"] as? String)
            XCTAssertEqual(copy["official"] as? Bool, false)
            XCTAssertNotEqual(copy["id"] as? String, map["id"] as? String)
            XCTAssertEqual((copy["difficulties"] as? [String: Any])?.count, 3)
        }
        XCTAssertEqual(try store.maps().count, maps.count)
    }

    func testExpansionPlaythroughsUnlockEveryAchievementAndPersist() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let catalogue = root.appendingPathComponent("Web/official-achievements.json")
        let fixtures = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("Tests/Fixtures/expansion-playthroughs.json"))) as? [String: [String: Int]])
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let store = try LocalStore(directory: directory, officialAchievementsURL: catalogue)
        XCTAssertEqual(fixtures.count, 15)
        for (key, result) in fixtures {
            let parts = key.split(separator: "|").map(String.init)
            let saved = try store.recordResult(mapID: parts[0], difficulty: parts[1], score: result["score"]!,
                cleared: true, duration: result["duration"]!, correct: result["correct"]!,
                wrong: result["wrong"]!, lines: result["lines"]!)
            XCTAssertEqual((saved["newlyUnlocked"] as? [String])?.count, ["easy": 1, "hard": 2, "master": 3][parts[1]], key)
        }
        XCTAssertEqual(try store.achievements().count, 30)
        let reopened = try LocalStore(directory: directory, officialAchievementsURL: catalogue)
        XCTAssertEqual(try reopened.achievements().count, 30)
    }

    func testOfficialAchievementsUseWebCriteriaAndPersist() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let catalogue = root.appendingPathComponent("Web/official-achievements.json")
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: directory) }
        let store = try LocalStore(directory: directory, officialAchievementsURL: catalogue)

        let failed = try store.recordResult(mapID: "showcase", difficulty: "easy", score: 2000,
                                            cleared: false, duration: 5)
        XCTAssertEqual(failed["newlyUnlocked"] as? [String], [])
        XCTAssertTrue(try store.achievements().isEmpty)

        let firstClear = try store.recordResult(mapID: "showcase", difficulty: "easy", score: 100,
                                                cleared: true, duration: 20)
        XCTAssertEqual(firstClear["newlyUnlocked"] as? [String], ["showcase-easy-clear"])
        XCTAssertEqual(try store.recordResult(mapID: "showcase", difficulty: "easy", score: 150,
                                               cleared: true, duration: 18)["newlyUnlocked"] as? [String], [])

        let scoreOnly = try store.recordResult(mapID: "showcase", difficulty: "hard", score: 950,
                                               cleared: true, duration: 60, wrong: 1)
        XCTAssertEqual(scoreOnly["newlyUnlocked"] as? [String], ["showcase-hard-score"])
        let perfect = try store.recordResult(mapID: "showcase", difficulty: "hard", score: 200,
                                             cleared: true, duration: 60, wrong: 0)
        XCTAssertEqual(perfect["newlyUnlocked"] as? [String], ["showcase-hard-perfect"])

        let master = try store.recordResult(mapID: "showcase", difficulty: "master", score: 1100,
                                            cleared: true, duration: 70, wrong: 0, lines: 4)
        XCTAssertEqual(master["newlyUnlocked"] as? [String],
                       ["showcase-master-score", "showcase-master-perfect", "showcase-master-lines"])
        let slow = try store.recordResult(mapID: "hourglass", difficulty: "master", score: 100,
                                          cleared: true, duration: 121, wrong: 1, lines: 20)
        XCTAssertFalse((slow["newlyUnlocked"] as? [String] ?? []).contains("hourglass-master-time"))
        let timed = try store.recordResult(mapID: "hourglass", difficulty: "master", score: 100,
                                           cleared: true, duration: 120, wrong: 1, lines: 20)
        XCTAssertTrue((timed["newlyUnlocked"] as? [String] ?? []).contains("hourglass-master-time"))

        let reopened = try LocalStore(directory: directory, officialAchievementsURL: catalogue)
        XCTAssertEqual(try reopened.achievements()["showcase-easy-clear"], true)
        XCTAssertEqual(try reopened.achievements()["hourglass-master-time"], true)
        _ = try reopened.recordResult(mapID: "custom-id", difficulty: "easy", score: 9000,
                                      cleared: true, duration: 1)
        XCTAssertEqual(try reopened.achievements().count, try store.achievements().count)
    }

    func testInvalidLayoutAndCodeRejected() throws {
        let store = try temporaryStore()
        var bad = sampleMap()
        bad["difficulties"] = ["easy": ["layout_content": "X", "time": 100]]
        XCTAssertThrowsError(try store.saveMap(bad))
        XCTAssertThrowsError(try store.importCode("INKBALL1.encrypted"))
    }

    func testWebMapRestrictionsApplyToSavedAndImportedMaps() throws {
        let store = try temporaryStore()
        let source = sampleMap()
        var noBalls = source
        var levels = try XCTUnwrap(noBalls["difficulties"] as? [String: [String: Any]])
        levels["easy"]?["balls"] = []
        noBalls["difficulties"] = levels
        XCTAssertThrowsError(try store.saveMap(noBalls))

        var noHole = source
        levels = try XCTUnwrap(noHole["difficulties"] as? [String: [String: Any]])
        let noHoleLayout = (levels["easy"]?["layout_content"] as? String)?.replacingOccurrences(of: "H0", with: "  ")
        levels["easy"]?["layout_content"] = noHoleLayout
        noHole["difficulties"] = levels
        XCTAssertThrowsError(try store.saveMap(noHole))
        let invalidEnvelope: [String: Any] = ["format": "INKBALL-MAP", "version": 1, "map": noHole]
        let invalidData = try JSONSerialization.data(withJSONObject: invalidEnvelope)
        XCTAssertThrowsError(try store.importCode("INKBALL-MAP/1\n" + String(decoding: invalidData, as: UTF8.self)))

        var wrongColour = source
        levels = try XCTUnwrap(wrongColour["difficulties"] as? [String: [String: Any]])
        levels["easy"]?["balls"] = ["orange"]
        let wrongColourLayout = (levels["easy"]?["layout_content"] as? String)?.replacingOccurrences(of: "H0", with: "H2")
        levels["easy"]?["layout_content"] = wrongColourLayout
        wrongColour["difficulties"] = levels
        XCTAssertThrowsError(try store.saveMap(wrongColour))

        var greyHole = source
        levels = try XCTUnwrap(greyHole["difficulties"] as? [String: [String: Any]])
        levels["easy"]?["balls"] = ["orange"]
        greyHole["difficulties"] = levels
        XCTAssertNoThrow(try store.saveMap(greyHole))

        var shortTime = source
        levels = try XCTUnwrap(shortTime["difficulties"] as? [String: [String: Any]])
        levels["easy"]?["time"] = 3
        shortTime["difficulties"] = levels
        XCTAssertThrowsError(try store.saveMap(shortTime))

        var longName = source
        longName["name"] = String(repeating: "a", count: 21)
        XCTAssertThrowsError(try store.saveMap(longName))

        var withBlankDifficulty = source
        levels = try XCTUnwrap(withBlankDifficulty["difficulties"] as? [String: [String: Any]])
        levels["hard"] = ["layout_content": ((noHole["difficulties"] as? [String: [String: Any]])?["easy"]?["layout_content"] as? String)?.replacingOccurrences(of: "S ", with: "  ") ?? "", "time": 100, "spawn_interval": 4, "balls": []]
        withBlankDifficulty["difficulties"] = levels
        XCTAssertNoThrow(try store.saveMap(withBlankDifficulty))
    }

    func testQueuedBallsRequireSpawnerForEachDifficulty() throws {
        let store = try temporaryStore()
        var map = sampleMap()
        var levels = try XCTUnwrap(map["difficulties"] as? [String: [String: Any]])
        var missingSpawner = try XCTUnwrap(levels["easy"])
        missingSpawner["layout_content"] = (missingSpawner["layout_content"] as? String)?.replacingOccurrences(of: "S ", with: "  ")
        levels["master"] = missingSpawner
        map["difficulties"] = levels
        XCTAssertThrowsError(try store.saveMap(map)) { error in
            XCTAssertTrue(error.localizedDescription.contains("master: A ball queue requires at least one spawn point."))
        }
        let envelope: [String: Any] = ["format": "INKBALL-MAP", "version": 1, "map": map]
        let encoded = try JSONSerialization.data(withJSONObject: envelope)
        XCTAssertThrowsError(try store.importCode("INKBALL-MAP/1\n" + String(decoding: encoded, as: UTF8.self)))

        // Balls placed on the board do not need an emitter when the queue is empty.
        missingSpawner["balls"] = []
        missingSpawner["layout_content"] = (missingSpawner["layout_content"] as? String)?.replacingOccurrences(of: "H0", with: "B0")
        // Add a hole without overlapping the placed ball.
        var rows = (missingSpawner["layout_content"] as? String ?? "").components(separatedBy: "\n")
        var cells = Array(rows[8])
        cells[16] = "H"; cells[17] = "0"
        rows[8] = String(cells)
        missingSpawner["layout_content"] = rows.joined(separator: "\n")
        levels["master"] = missingSpawner
        map["difficulties"] = levels
        XCTAssertNoThrow(try store.saveMap(map))
    }
}
