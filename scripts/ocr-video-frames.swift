import AppKit
import Foundation
import Vision

struct OCRFrame: Codable {
    let file: String
    let lines: [String]
}

guard CommandLine.arguments.count == 3 else {
    FileHandle.standardError.write(
        Data("Usage: swift scripts/ocr-video-frames.swift <frames-directory> <output-json>\n".utf8)
    )
    exit(2)
}

let framesDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let fileManager = FileManager.default
let frameURLs = try fileManager.contentsOfDirectory(
    at: framesDirectory,
    includingPropertiesForKeys: nil,
    options: [.skipsHiddenFiles]
).filter { ["png", "jpg", "jpeg"].contains($0.pathExtension.lowercased()) }
 .sorted { $0.lastPathComponent < $1.lastPathComponent }

var output: [OCRFrame] = []

for frameURL in frameURLs {
    guard
        let image = NSImage(contentsOf: frameURL),
        let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    else {
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = (request.results ?? []).sorted {
        let verticalDelta = $0.boundingBox.midY - $1.boundingBox.midY
        if abs(verticalDelta) > 0.02 {
            return verticalDelta > 0
        }
        return $0.boundingBox.minX < $1.boundingBox.minX
    }
    let lines = observations.compactMap {
        $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
    }.filter { !$0.isEmpty }

    output.append(OCRFrame(file: frameURL.lastPathComponent, lines: lines))
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(output).write(to: outputURL)
print("OCR complete: \(output.count) frames")
