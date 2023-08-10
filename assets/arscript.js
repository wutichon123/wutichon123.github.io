
// Invitation Video Handler
var isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
AFRAME.registerComponent("video-vidhandler", {
    schema: {
        element: { default: "" },
        videoId: { default: "" },
    },
    init: function () {
        console.log("vidint", this.data.videoId);
        this.toggle = false;
        this.vid = this.data.videoId && document.querySelector(this.data.videoId);
        if (!isSafari) this.vid.muted = false;
        this.vid.pause();
    },
    tick: function () {
        if (this.el.object3D.visible == true) {
            if (!this.toggle) {
                this.toggle = true;
                if (!isSafari) this.vid.muted = false;

            this.vid.play();
            }
        } else {
            this.toggle = false;
            this.vid.pause();
        }
    },
});

// Component that detects and emits events for touch gestures

AFRAME.registerComponent("gesture-detector", {
    schema: {
        element: { default: "" },
    },

    init: function () {
        this.targetElement =
            this.data.element && document.querySelector(this.data.element);

        if (!this.targetElement) {
            this.targetElement = this.el;
        }

        this.internalState = {
            previousState: null,
        };

        this.emitGestureEvent = this.emitGestureEvent.bind(this);

        this.targetElement.addEventListener("touchstart", this.emitGestureEvent);

        this.targetElement.addEventListener("touchend", this.emitGestureEvent);

        this.targetElement.addEventListener("touchmove", this.emitGestureEvent);
    },

    remove: function () {
        this.targetElement.removeEventListener("touchstart", this.emitGestureEvent);

        this.targetElement.removeEventListener("touchend", this.emitGestureEvent);

        this.targetElement.removeEventListener("touchmove", this.emitGestureEvent);
    },

    emitGestureEvent(event) {
        const currentState = this.getTouchState(event);

        const previousState = this.internalState.previousState;

        const gestureContinues =
            previousState &&
            currentState &&
            currentState.touchCount == previousState.touchCount;

        const gestureEnded = previousState && !gestureContinues;

        const gestureStarted = currentState && !gestureContinues;

        if (gestureEnded) {
            const eventName =
                this.getEventPrefix(previousState.touchCount) + "fingerend";

            this.el.emit(eventName, previousState);

            this.internalState.previousState = null;
        }

        if (gestureStarted) {
            currentState.startTime = performance.now();

            currentState.startPosition = currentState.position;

            currentState.startSpread = currentState.spread;

            const eventName =
                this.getEventPrefix(currentState.touchCount) + "fingerstart";

            this.el.emit(eventName, currentState);

            this.internalState.previousState = currentState;
        }

        if (gestureContinues) {
            const eventDetail = {
                positionChange: {
                    x: currentState.position.x - previousState.position.x,

                    y: currentState.position.y - previousState.position.y,
                },
            };

            if (currentState.spread) {
                eventDetail.spreadChange = currentState.spread - previousState.spread;
            }

            // Update state with new data

            Object.assign(previousState, currentState);

            // Add state data to event detail

            Object.assign(eventDetail, previousState);

            const eventName =
                this.getEventPrefix(currentState.touchCount) + "fingermove";

            this.el.emit(eventName, eventDetail);
        }
    },

    getTouchState: function (event) {
        if (event.touches.length === 0) {
            return null;
        }

        // Convert event.touches to an array so we can use reduce

        const touchList = [];

        for (let i = 0; i < event.touches.length; i++) {
            touchList.push(event.touches[i]);
        }

        const touchState = {
            touchCount: touchList.length,
        };

        // Calculate center of all current touches

        const centerPositionRawX =
            touchList.reduce((sum, touch) => sum + touch.clientX, 0) /
            touchList.length;

        const centerPositionRawY =
            touchList.reduce((sum, touch) => sum + touch.clientY, 0) /
            touchList.length;

        touchState.positionRaw = { x: centerPositionRawX, y: centerPositionRawY };

        // Scale touch position and spread by average of window dimensions

        const screenScale = 2 / (window.innerWidth + window.innerHeight);

        touchState.position = {
            x: centerPositionRawX * screenScale,
            y: centerPositionRawY * screenScale,
        };

        // Calculate average spread of touches from the center point

        if (touchList.length >= 2) {
            const spread =
                touchList.reduce((sum, touch) => {
                    return (
                        sum +
                        Math.sqrt(
                            Math.pow(centerPositionRawX - touch.clientX, 2) +
                            Math.pow(centerPositionRawY - touch.clientY, 2)
                        )
                    );
                }, 0) / touchList.length;

            touchState.spread = spread * screenScale;
        }

        return touchState;
    },

    getEventPrefix(touchCount) {
        const numberNames = ["one", "two", "three", "many"];

        return numberNames[Math.min(touchCount, 4) - 1];
    },
});

AFRAME.registerComponent("gesture-handler", {
    schema: {
        enabled: { default: true },
        rotationFactor: { default: 5 },
        minScale: { default: 0.3 },
        maxScale: { default: 8 },
    },

    init: function () {
        this.handleScale = this.handleScale.bind(this);
        this.handleRotation = this.handleRotation.bind(this);

        this.isVisible = false;
        this.initialScale = this.el.object3D.scale.clone();
        this.scaleFactor = 1;

        this.el.sceneEl.addEventListener("markerFound", (e) => {
            this.isVisible = true;
        });

        this.el.sceneEl.addEventListener("markerLost", (e) => {
            this.isVisible = false;
        });
    },

    update: function () {
        if (this.data.enabled) {
            this.el.sceneEl.addEventListener("onefingermove", this.handleRotation);
            this.el.sceneEl.addEventListener("twofingermove", this.handleScale);
        } else {
            this.el.sceneEl.removeEventListener("onefingermove", this.handleRotation);
            this.el.sceneEl.removeEventListener("twofingermove", this.handleScale);
        }
    },

    remove: function () {
        this.el.sceneEl.removeEventListener("onefingermove", this.handleRotation);
        this.el.sceneEl.removeEventListener("twofingermove", this.handleScale);
    },

    handleRotation: function (event) {
        if (this.isVisible) {
            this.el.object3D.rotation.y +=
                event.detail.positionChange.x * this.data.rotationFactor;
            this.el.object3D.rotation.x +=
                event.detail.positionChange.y * this.data.rotationFactor;
        }
    },

    handleScale: function (event) {
        if (this.isVisible) {
            this.scaleFactor *=
                1 + event.detail.spreadChange / event.detail.startSpread;

            this.scaleFactor = Math.min(
                Math.max(this.scaleFactor, this.data.minScale),
                this.data.maxScale
            );

            this.el.object3D.scale.x = this.scaleFactor * this.initialScale.x;
            this.el.object3D.scale.y = this.scaleFactor * this.initialScale.y;
            this.el.object3D.scale.z = this.scaleFactor * this.initialScale.z;
        }
    },
});

// Function to check if the monitor display should be shown
function showMonitorDisplay() {
    const monitor = document.getElementById("monitor");
    const visibleEntity = document.querySelector(
        "a-entity:not([style*='display: none'])"
    );
}

// Check for visible entities on scene load
window.addEventListener("load", showMonitorDisplay);

// Check for visible entities on entity changes (you may need to modify this depending on your application's behavior)
window.addEventListener("DOMNodeInserted", showMonitorDisplay);
window.addEventListener("DOMNodeRemoved", showMonitorDisplay);

// JavaScript code to remove the loading overlay and display the confirmation dialog once assets are loaded
document.addEventListener("DOMContentLoaded", function () {
    const loadingOverlay = document.getElementById("loading-overlay");
    const nftLoadingAnimation = document.getElementById("nft-loading-animation");
    const confirmationDialog = document.getElementById("loading-finished-dialog");
    const assets = document.querySelectorAll("a-assets");
    const monitor = document.getElementById("monitor");

    const checkAssetsLoaded = function () {
        for (const asset of assets) {
            if (!asset.hasLoaded) {
                return false;
            }
        }
        return true;
    };

    const removeLoadingOverlay = function () {
        if (checkAssetsLoaded()) {
            loadingOverlay.style.display = "none";
            nftLoadingAnimation.style.display = "none";
            confirmationDialog.style.display = "block";
        } else {
            requestAnimationFrame(removeLoadingOverlay);
        }
    };

    // Show NFT loading animation after regular loading overlay is removed
    loadingOverlay.addEventListener("transitionend", function () {
        loadingOverlay.style.display = "none";
        nftLoadingAnimation.style.display = "block";
        removeLoadingOverlay();
    });

    removeLoadingOverlay();
});

// Move the closeConfirmationDialog function to the global scope
function closeConfirmationDialog() {
    const confirmationDialog = document.getElementById("loading-finished-dialog");
    confirmationDialog.style.display = "none";
    const monitor = document.getElementById("monitor");
    monitor.style.display = "block";
}

// Add event listener to the OK button
document.addEventListener("DOMContentLoaded", function () {
    const okButton = document.getElementById("ok-button");
    okButton.addEventListener("click", closeConfirmationDialog);
});


AFRAME.registerComponent("onmarkerfound", {
    init: function () {
        this.onMarkerFound = this.onMarkerFound.bind(this);
        this.el.addEventListener("markerFound", this.onMarkerFound);
    },
    onMarkerFound: function (event) {
        console.log("🚀 MarkerFound");
        monitor.style.display = "none";
        // Additional actions you want to perform when a marker is found.
    },
    remove: function () {
        this.el.removeEventListener("markerFound", this.onMarkerFound);
    },
});

AFRAME.registerComponent("onmarkerlost", {
    init: function () {
        this.onMarkerLost = this.onMarkerLost.bind(this);
        this.el.addEventListener("markerLost", this.onMarkerLost);
    },
    onMarkerLost: function (event) {
        console.log("🚀 MarkerLost");
        monitor.style.display = "block";
        // Additional actions you want to perform when a marker is lost.
    },
    remove: function () {
        this.el.removeEventListener("markerLost", this.onMarkerLost);
    },
});
