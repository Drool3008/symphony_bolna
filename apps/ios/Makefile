# Every check is one command. The project is generated from project.yml.
#   make generate   write Vantari.xcodeproj from project.yml (XcodeGen)
#   make build      build the app for the simulator
#   make run        build, install and launch on the simulator
#   make screenshots  save a screenshot of the booted simulator to $(SHOTS)

SIMULATOR ?= iPhone 17
DESTINATION ?= platform=iOS Simulator,name=$(SIMULATOR)
DERIVED ?= .build/DerivedData
SHOTS ?= .build/screenshots
SCHEME := Vantari
BUNDLE_ID := org.familyhealth.Vantari
XCODEBUILD := xcodebuild -project Vantari.xcodeproj -scheme $(SCHEME) -destination '$(DESTINATION)' -derivedDataPath $(DERIVED)

.PHONY: generate build run screenshots

generate:
	xcodegen generate --quiet

build: generate
	$(XCODEBUILD) -quiet build

run: build
	xcrun simctl boot '$(SIMULATOR)' 2>/dev/null || true
	xcrun simctl install booted "$(DERIVED)/Build/Products/Debug-iphonesimulator/$(SCHEME).app"
	xcrun simctl launch booted $(BUNDLE_ID)

screenshots:
	mkdir -p $(SHOTS)
	xcrun simctl io booted screenshot "$(SHOTS)/$$(date +%Y%m%d-%H%M%S).png"
