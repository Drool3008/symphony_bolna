import Foundation

/// Where the family's server is (brief, Section 2).
///
/// From the `API_BASE` build setting, which Config/Base.xcconfig writes into
/// Info.plist; never hard-coded here. A launch argument `-API_BASE <url>` wins
/// over it, through UserDefaults' argument domain, so a UI test can point the
/// app at a backend of its own.
enum Backend {
    static var base: URL {
        let fromLaunch = UserDefaults.standard.string(forKey: "API_BASE")
        let fromBuild = Bundle.main.object(forInfoDictionaryKey: "API_BASE") as? String
        guard let text = fromLaunch ?? fromBuild, let url = URL(string: text) else {
            preconditionFailure("API_BASE is missing from Info.plist; check Config/Base.xcconfig")
        }
        return url
    }
}
