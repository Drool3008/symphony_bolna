import Foundation
import Testing
@testable import Vantari

@Suite("Strings")
struct StringsTests {
    let en = Strings(language: "en-IN")
    let te = Strings(language: "te-IN")

    @Test func everyKeyHasEnglishAndTelugu() {
        for key in StringKey.allCases {
            #expect(en.t(key) != key.rawValue, "no English for \(key.rawValue)")
            #expect(te.t(key) != key.rawValue, "no Telugu for \(key.rawValue)")
        }
    }

    @Test func picksTheTableFromTheOnboardingLanguageNotTheDevice() {
        #expect(te.t(.medicines) == "మందులు")
        #expect(en.t(.medicines) == "Medicines")
        #expect(te.t(.tabAgent) == "చాట్")
    }

    @Test func fillsInValues() {
        #expect(en.t(.runsOut, ["d": "9 Oct"]) == "runs out 9 Oct")
        #expect(en.t(.answeredBy, ["name": "Arun"]) == "Answered by Arun")
    }

    @Test func groupsRupeesAsIndiaWritesThem() {
        #expect(en.rupees(4680) == "₹4,680")
        #expect(te.rupees(320) == "₹320")
        #expect(en.rupees(125000) == "₹1,25,000")
    }

    @Test func showsTheYearOnlyWhenItIsNotTheYearOnTheFamilyClock() {
        #expect(en.date("2026-10-09", today: "2026-10-06") == "9 Oct")
        #expect(en.date("2027-07-18", today: "2026-10-06") == "18 Jul 2027")
    }

    @Test func tellsTheTimeOnTheFamilysClock() {
        // 18:30 UTC is midnight in India.
        #expect(en.time("2026-10-08T18:30:00.000Z").lowercased().hasPrefix("12:00"))
        #expect(en.longDate("2026-10-08T18:30:00.000Z") == "Friday, 9 October")
    }
}
