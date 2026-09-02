import AppKit
import WebKit

private let applicationName = "DeepSeek Harness"
private let upstreamProjectURL = URL(string: "https://github.com/deepseek-ai/deepseek-harness")!
private let readinessPrefix = "dsh web: "
private let titlebarDragHeight: CGFloat = 28

/// Native hit region matching the Web client's macOS title-bar clearance.
private final class TitlebarDragView: NSView {
    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 {
            window?.performZoom(self)
            return
        }
        window?.performDrag(with: event)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var loadingView: NSVisualEffectView!
    private var statusLabel: NSTextField!
    private var backendProcess: Process?
    private var backendURL: URL?
    private var logHandle: FileHandle?
    private var outputBuffer = Data()
    private let outputQueue = DispatchQueue(label: "io.github.eddieewei.deepseek-harness.backend-output")
    private var startupTimeout: DispatchWorkItem?
    private var isQuitting = false
    private var terminationReplyPending = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        configureMenu()
        configureWindow()
        do {
            try startBackend()
        } catch {
            showFailure("The local DeepSeek Harness service could not start: \(error.localizedDescription)")
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard !isQuitting, let process = backendProcess, process.isRunning else {
            return .terminateNow
        }
        isQuitting = true
        terminationReplyPending = true
        process.terminate()
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self, weak process] in
            guard let self, self.terminationReplyPending else { return }
            if let process, process.isRunning {
                let killer = Process()
                killer.executableURL = URL(fileURLWithPath: "/bin/kill")
                killer.arguments = ["-KILL", String(process.processIdentifier)]
                try? killer.run()
                killer.waitUntilExit()
            }
            self.finishTermination()
        }
        return .terminateLater
    }

    func applicationWillTerminate(_ notification: Notification) {
        startupTimeout?.cancel()
        logHandle?.closeFile()
    }

    func windowWillClose(_ notification: Notification) {
        NSApp.terminate(nil)
    }

    private func configureWindow() {
        let controller = WKUserContentController()
        controller.addUserScript(WKUserScript(
            source: "document.documentElement.dataset.dshDesktop='macos'",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .nonPersistent()
        if ProcessInfo.processInfo.environment["DSH_ENABLE_WEB_INSPECTOR"] == "1" {
            configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        }

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = true
        webView.allowsBackForwardNavigationGestures = false
        webView.isHidden = true

        loadingView = NSVisualEffectView()
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        loadingView.material = .sidebar
        loadingView.blendingMode = .behindWindow
        loadingView.state = .active

        let spinner = NSProgressIndicator()
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.style = .spinning
        spinner.controlSize = .regular
        spinner.startAnimation(nil)

        statusLabel = NSTextField(labelWithString: "Starting the embedded DeepSeek Harness runtime…")
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .systemFont(ofSize: 15, weight: .medium)
        statusLabel.textColor = .secondaryLabelColor

        let statusStack = NSStackView(views: [spinner, statusLabel])
        statusStack.translatesAutoresizingMaskIntoConstraints = false
        statusStack.orientation = .vertical
        statusStack.alignment = .centerX
        statusStack.spacing = 14
        loadingView.addSubview(statusStack)
        NSLayoutConstraint.activate([
            statusStack.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            statusStack.centerYAnchor.constraint(equalTo: loadingView.centerYAnchor),
        ])

        let content = NSView()
        let titlebarDragView = TitlebarDragView()
        titlebarDragView.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(webView)
        content.addSubview(loadingView)
        content.addSubview(titlebarDragView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            webView.topAnchor.constraint(equalTo: content.topAnchor),
            webView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            loadingView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            loadingView.topAnchor.constraint(equalTo: content.topAnchor),
            loadingView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            titlebarDragView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            titlebarDragView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            titlebarDragView.topAnchor.constraint(equalTo: content.topAnchor),
            titlebarDragView.heightAnchor.constraint(equalToConstant: titlebarDragHeight),
        ])

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = applicationName
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none
        window.minSize = NSSize(width: 960, height: 640)
        window.contentView = content
        window.delegate = self
        window.setFrameAutosaveName("DeepSeekHarnessMainWindow")
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func configureMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        let about = NSMenuItem(title: "About \(applicationName)", action: #selector(showAbout), keyEquivalent: "")
        about.target = self
        appMenu.addItem(about)
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide \(applicationName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h").keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit \(applicationName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        mainMenu.addItem(editItem)

        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        let reload = NSMenuItem(title: "Reload", action: #selector(reloadPage), keyEquivalent: "r")
        reload.target = self
        viewMenu.addItem(reload)
        viewMenu.addItem(.separator())
        for (title, action, key) in [("Actual Size", #selector(resetZoom), "0"), ("Zoom In", #selector(zoomIn), "+"), ("Zoom Out", #selector(zoomOut), "-")] {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.target = self
            viewMenu.addItem(item)
        }
        viewItem.submenu = viewMenu
        mainMenu.addItem(viewItem)

        let helpItem = NSMenuItem()
        let helpMenu = NSMenu(title: "Help")
        let upstream = NSMenuItem(title: "DeepSeek Harness Source", action: #selector(openUpstreamProject), keyEquivalent: "")
        upstream.target = self
        helpMenu.addItem(upstream)
        let attribution = NSMenuItem(title: "Open Source Attribution", action: #selector(openAttribution), keyEquivalent: "")
        attribution.target = self
        helpMenu.addItem(attribution)
        helpMenu.addItem(.separator())
        let skills = NSMenuItem(title: "Open User Skills Folder", action: #selector(openUserSkills), keyEquivalent: "")
        skills.target = self
        helpMenu.addItem(skills)
        let data = NSMenuItem(title: "Open Local Data Folder", action: #selector(openLocalData), keyEquivalent: "")
        data.target = self
        helpMenu.addItem(data)
        let resources = NSMenuItem(title: "Open Application Resources", action: #selector(openApplicationResources), keyEquivalent: "")
        resources.target = self
        helpMenu.addItem(resources)
        helpMenu.addItem(.separator())
        let logs = NSMenuItem(title: "Open Runtime Log", action: #selector(openLog), keyEquivalent: "")
        logs.target = self
        helpMenu.addItem(logs)
        helpItem.submenu = helpMenu
        mainMenu.addItem(helpItem)

        NSApp.mainMenu = mainMenu
    }

    private func runtimeURL(_ relativePath: String) throws -> URL {
        guard let resources = Bundle.main.resourceURL else {
            throw NSError(domain: "DeepSeekHarnessApp", code: 1, userInfo: [NSLocalizedDescriptionKey: "Application resources are missing."])
        }
        let url = resources.appendingPathComponent(relativePath)
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw NSError(domain: "DeepSeekHarnessApp", code: 2, userInfo: [NSLocalizedDescriptionKey: "Bundled runtime file is missing: \(relativePath)"])
        }
        return url
    }

    private func startBackend() throws {
        let node = try runtimeURL("runtime/node/bin/node")
        let entry = try runtimeURL("runtime/app/node_modules/@deepseek-ai/dsh/lib/bin.js")
        let logURL = try prepareLogFile()
        logHandle = try FileHandle(forWritingTo: logURL)
        try logHandle?.seekToEnd()

        let pipe = Pipe()
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeBackendOutput(data)
        }

        let process = Process()
        process.executableURL = node
        process.arguments = [entry.path, "web", "--host", "127.0.0.1", "--port", "0", "--no-open"]
        process.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser
        var environment = ProcessInfo.processInfo.environment
        environment["NO_COLOR"] = "1"
        environment.removeValue(forKey: "NODE_OPTIONS")
        environment.removeValue(forKey: "NODE_PATH")
        process.environment = environment
        process.standardOutput = pipe
        process.standardError = pipe
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self else { return }
                if self.terminationReplyPending {
                    self.finishTermination()
                } else if !self.isQuitting {
                    self.showFailure("The local service exited with status \(process.terminationStatus).")
                }
            }
        }

        try process.run()
        backendProcess = process
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, self.backendURL == nil, !self.isQuitting else { return }
            self.showFailure("The local service did not become ready within 60 seconds.")
        }
        startupTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 60, execute: timeout)
    }

    private func consumeBackendOutput(_ data: Data) {
        outputQueue.async { [weak self] in
            guard let self else { return }
            self.outputBuffer.append(data)
            while let newline = self.outputBuffer.firstIndex(of: 0x0A) {
                let lineData = self.outputBuffer.prefix(upTo: newline)
                self.outputBuffer.removeSubrange(...newline)
                guard let line = String(data: lineData, encoding: .utf8) else { continue }
                let redacted = line.replacingOccurrences(
                    of: "([?&]token=)[^\\s)]+",
                    with: "$1<redacted>",
                    options: .regularExpression
                )
                try? self.logHandle?.write(contentsOf: Data((redacted + "\n").utf8))
                self.observeBackendLine(line.trimmingCharacters(in: .whitespacesAndNewlines))
            }
        }
    }

    private func observeBackendLine(_ line: String) {
        guard line.hasPrefix(readinessPrefix) else { return }
        let remainder = line.dropFirst(readinessPrefix.count)
        guard let candidate = remainder.split(separator: " ").first,
              let components = URLComponents(string: String(candidate)),
              components.scheme == "http", components.host == "127.0.0.1",
              components.path == "/", components.fragment == nil,
              let queryItems = components.queryItems,
              queryItems.count == 1, queryItems[0].name == "token",
              let token = queryItems[0].value, token.count >= 32,
              token.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") }),
              let url = components.url else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.backendURL == nil else { return }
            self.backendURL = url
            self.startupTimeout?.cancel()
            self.loadHarness()
        }
    }

    private func loadHarness() {
        guard let backendURL else { return }
        webView.load(URLRequest(url: backendURL, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func finishTermination() {
        guard terminationReplyPending else { return }
        terminationReplyPending = false
        NSApp.reply(toApplicationShouldTerminate: true)
    }

    private func prepareLogFile() throws -> URL {
        let directory = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/DeepSeek Harness", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent("runtime.log")
        if !FileManager.default.fileExists(atPath: url.path) {
            FileManager.default.createFile(atPath: url.path, contents: nil)
        }
        return url
    }

    private func showFailure(_ message: String) {
        startupTimeout?.cancel()
        statusLabel.stringValue = "DeepSeek Harness could not start"
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "DeepSeek Harness could not start"
        alert.informativeText = message
        alert.addButton(withTitle: "Open Log")
        alert.addButton(withTitle: "Quit")
        alert.beginSheetModal(for: window) { [weak self] response in
            if response == .alertFirstButtonReturn { self?.openLog() }
            else { NSApp.terminate(nil) }
        }
    }

    @objc private func reloadPage() { webView.reload() }
    @objc private func resetZoom() { webView.pageZoom = 1 }
    @objc private func zoomIn() { webView.pageZoom = min(webView.pageZoom + 0.1, 2) }
    @objc private func zoomOut() { webView.pageZoom = max(webView.pageZoom - 0.1, 0.6) }
    @objc private func showAbout() {
        let version = Bundle.main.object(forInfoDictionaryKey: "DSHHarnessVersion") as? String ?? "Unknown"
        let revision = Bundle.main.object(forInfoDictionaryKey: "DSHSourceRevision") as? String ?? "Unknown"
        let shortRevision = revision.count >= 7 ? String(revision.prefix(7)) : revision
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: applicationName,
            .applicationVersion: "Harness \(version) · macOS adaptation \(shortRevision)",
            .version: "Community build",
            .credits: NSAttributedString(string: "Independent community distribution. Source and license details are available from the Help menu."),
        ])
    }

    private func openOrCreateDirectory(_ url: URL) {
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        NSWorkspace.shared.open(url)
    }

    @objc private func openUserSkills() {
        openOrCreateDirectory(FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".dsh/skills", isDirectory: true))
    }

    @objc private func openLocalData() {
        openOrCreateDirectory(FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".dsh", isDirectory: true))
    }

    @objc private func openApplicationResources() {
        guard let resources = Bundle.main.resourceURL else { return }
        NSWorkspace.shared.open(resources)
    }

    @objc private func openLog() {
        let url = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/DeepSeek Harness/runtime.log")
        if FileManager.default.fileExists(atPath: url.path) { NSWorkspace.shared.open(url) }
    }

    @objc private func openUpstreamProject() {
        NSWorkspace.shared.open(upstreamProjectURL)
    }

    @objc private func openAttribution() {
        guard let url = Bundle.main.url(forResource: "ATTRIBUTION", withExtension: "txt") else { return }
        NSWorkspace.shared.open(url)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView.url?.host == "127.0.0.1" else { return }
        webView.isHidden = false
        loadingView.isHidden = true
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.scheme == "about" || (url.scheme == "http" && url.host == "127.0.0.1" && url.port == backendURL?.port) {
            decisionHandler(.allow)
            return
        }
        if navigationAction.navigationType == .linkActivated,
           (url.scheme == "https" || url.scheme == "http") {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.run()
