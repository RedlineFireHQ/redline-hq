import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = StartupBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        (window?.rootViewController as? StartupBridgeViewController)?.coverForInactivity()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        (window?.rootViewController as? StartupBridgeViewController)?.resumeStartup()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

private final class StartupBridgeViewController: CAPBridgeViewController {
    private let splashView = UIImageView(image: UIImage(named: "Splash"))
    private var displayLink: CADisplayLink?
    private var isCheckingReadiness = false
    private var hasCompletedStartup = false
    private var readinessGeneration = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        splashView.contentMode = .scaleAspectFill
        splashView.clipsToBounds = true
        splashView.backgroundColor = UIColor(white: 0.03, alpha: 1)
        splashView.isUserInteractionEnabled = true
        splashView.accessibilityViewIsModal = true
        showCover()
    }

    private func showCover() {
        splashView.frame = view.bounds
        splashView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(splashView)
    }

    func coverForInactivity() {
        readinessGeneration += 1
        displayLink?.invalidate()
        displayLink = nil
        showCover()
    }

    func resumeStartup() {
        if hasCompletedStartup {
            splashView.removeFromSuperview()
            return
        }
        guard displayLink == nil else { return }
        let target = StartupDisplayLinkTarget(controller: self)
        let link = CADisplayLink(target: target, selector: #selector(StartupDisplayLinkTarget.checkReadiness))
        link.preferredFramesPerSecond = 5
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    fileprivate func checkReadiness() {
        guard !hasCompletedStartup, !isCheckingReadiness,
              view.window?.windowScene?.activationState == .foregroundActive,
              let webView = webView, !webView.isLoading,
              let url = webView.url, let serverURL = bridge?.config.serverURL,
              url.scheme == serverURL.scheme, url.host == serverURL.host, url.port == serverURL.port,
              url.path == "/mobile" || url.path == "/login" else { return }

        isCheckingReadiness = true
        let generation = readinessGeneration
        webView.callAsyncJavaScript(Self.readinessScript, arguments: [:], in: nil, in: .defaultClient) { [weak self] result in
            guard let self = self else { return }
            self.isCheckingReadiness = false
            guard generation == self.readinessGeneration,
                  self.view.window?.windowScene?.activationState == .foregroundActive,
                  !webView.isLoading, webView.url == url,
                  case .success(let value) = result, value as? Bool == true else { return }
            self.hasCompletedStartup = true
            self.displayLink?.invalidate()
            self.displayLink = nil
            self.splashView.removeFromSuperview()
        }
    }

    private static let readinessScript = """
    const visible = (element) => {
        if (!element || !element.getClientRects().length) return false;
        const style = getComputedStyle(element);
        return style.visibility === "visible" && style.display !== "none" && Number(style.opacity) > 0;
    };
    const ready = () => {
        if (document.readyState !== "complete") return false;
        const main = document.querySelector("main");
        if (!visible(main)) return false;
        if (location.pathname === "/mobile") {
            return visible(document.querySelector('nav[aria-label="Mobile navigation"]')) &&
                visible(main.querySelector('a[href="/mobile/apparatus-checks"]'));
        }
        if (location.pathname === "/login") {
            return visible(main.querySelector('input#email')) &&
                visible(main.querySelector('input#password')) &&
                visible(main.querySelector('button[type="submit"]:not(:disabled)'));
        }
        return false;
    };
    const initialURL = location.href;
    if (!ready()) return false;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return location.href === initialURL && ready();
    """

    deinit {
        displayLink?.invalidate()
    }
}

private final class StartupDisplayLinkTarget: NSObject {
    private weak var controller: StartupBridgeViewController?

    init(controller: StartupBridgeViewController) {
        self.controller = controller
    }

    @objc func checkReadiness() {
        controller?.checkReadiness()
    }
}
