import AppKit

guard CommandLine.arguments.count == 3 else {
    fatalError("usage: IconRasterizer <source.svg> <output.png>")
}

let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = NSImage(contentsOf: sourceURL) else {
    fatalError("Unable to load \(sourceURL.path)")
}

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
NSColor.white.setFill()
tile.fill()
NSGraphicsContext.restoreGraphicsState()

source.draw(
    in: NSRect(x: 258, y: 258, width: 508, height: 508),
    from: .zero,
    operation: .sourceOver,
    fraction: 1,
    respectFlipped: true,
    hints: [.interpolation: NSImageInterpolation.high]
)
canvas.unlockFocus()

guard let tiff = canvas.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Unable to render app icon")
}
try png.write(to: outputURL)
