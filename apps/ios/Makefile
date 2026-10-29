# Every check is one command. The project is generated from project.yml.
#   make generate   write Vantari.xcodeproj from project.yml (XcodeGen)
#   make build      build the app for the simulator
#   make test       run the unit and UI tests on the simulator
#   make run        build, install and launch on the simulator
#   make lan        point a device build at this Mac's LAN address
#   make screenshots  save a screenshot of the booted simulator to $(SHOTS)

SIMULATOR ?= iPhone 17
DESTINATION ?= platform=iOS Simulator,name=$(SIMULATOR)
DERIVED ?= .build/DerivedData
# The tests' own backend: a spare port, away from 8787 and from a backend someone runs.
TEST_PORT ?= 8799
SHOTS ?= .build/screenshots
SCHEME := Vantari
BUNDLE_ID := org.familyhealth.Vantari
XCODEBUILD := xcodebuild -project Vantari.xcodeproj -scheme $(SCHEME) -destination '$(DESTINATION)' -derivedDataPath $(DERIVED)

.PHONY: generate build test run lan screenshots

generate:
	xcodegen generate --quiet

build: generate
	$(XCODEBUILD) -quiet build

test: generate
	TEST_RUNNER_API_BASE=http://localhost:$(TEST_PORT) scripts/with-backend.sh $(TEST_PORT) -- $(XCODEBUILD) -quiet test

run: build
	xcrun simctl boot '$(SIMULATOR)' 2>/dev/null || true
	xcrun simctl install booted "$(DERIVED)/Build/Products/Debug-iphonesimulator/$(SCHEME).app"
	xcrun simctl launch booted $(BUNDLE_ID)

lan:
	scripts/lan-xcconfig.sh

screenshots:
	mkdir -p $(SHOTS)
	xcrun simctl io booted screenshot "$(SHOTS)/$$(date +%Y%m%d-%H%M%S).png"
