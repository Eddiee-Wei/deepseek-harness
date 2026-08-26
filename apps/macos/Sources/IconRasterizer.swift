import AppKit

guard CommandLine.arguments.count == 2 else {
    fatalError("usage: IconRasterizer <output.png>")
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])

let canvas = NSImage(size: NSSize(width: 1024, height: 1024))
canvas.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high

let tile = NSBezierPath(roundedRect: NSRect(x: 72, y: 72, width: 880, height: 880), xRadius: 196, yRadius: 196)
NSGraphicsContext.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.20)
shadow.shadowBlurRadius = 42
shadow.shadowOffset = NSSize(width: 0, height: -18)
shadow.set()
let gradient = NSGradient(colors: [
    NSColor(red: 0.08, green: 0.12, blue: 0.22, alpha: 1),
    NSColor(red: 0.12, green: 0.32, blue: 0.48, alpha: 1),
])!
gradient.draw(in: tile, angle: -48)
NSGraphicsContext.restoreGraphicsState()

let terminal = NSBezierPath(roundedRect: NSRect(x: 210, y: 264, width: 604, height: 496), xRadius: 92, yRadius: 92)
NSColor.black.withAlphaComponent(0.28).setFill()
terminal.fill()

let mark = ">_" as NSString
let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
mark.draw(
    in: NSRect(x: 220, y: 342, width: 584, height: 270),
    withAttributes: [
        .font: NSFont.monospacedSystemFont(ofSize: 230, weight: .semibold),
        .foregroundColor: NSColor.white,
        .paragraphStyle: paragraph,
    ]
)

let name = "DSH" as NSString
name.draw(
    in: NSRect(x: 220, y: 268, width: 584, height: 92),
    withAttributes: [
        .font: NSFont.systemFont(ofSize: 54, weight: .bold),
        .foregroundColor: NSColor.white.withAlphaComponent(0.74),
        .paragraphStyle: paragraph,
    ]
)
canvas.unlockFocus()

guard let tiff = canvas.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to render app icon")
}
try png.write(to: outputURL)
