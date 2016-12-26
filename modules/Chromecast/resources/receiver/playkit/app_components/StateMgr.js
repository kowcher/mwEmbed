/**
 * @constructor
 */
function StateManager() {
    this.KALTURA_DEFAULT_LOGO_URL = "assets/kaltura-logo.png";
    this.PAUSE_TIMEOUT_DURATION = 5 * 1000;
    this.currState = null;
    this.idleManager = new IdleManager();
    this.logoUrl = null;
    this.isPlaying = false;
    this.isOverlayShown = false;
    this.pauseTimeout = null;
    this.beforePlayControls = $( '#cast-before-play-controls' );
    this.inPlayControls = $( '#cast-in-play-controls' );
    this.mediaInfoContainer = $( '#cast-media-info' );
    this.logoDiv = $( '#logo' );
    this.stateBtnContainer = $( '#cast-state-button-container' );
    this.pauseBtn = $( '#cast-pause-button' );
    this.loadingSpinner = $( '#cast-loading-spinner' );
    this.bufferingSpinner = $( '#cast-buffering-spinner' );
    this.watermark = $( '#cast-watermark' );
    this.gradient = $( '#cast-gradient' );
    this.curTimeDiv = $( '#cast-current-time' );
    this.totalTimeDiv = $( '#cast-total-time' );
    this.progressFill = $( '.cast-media-progress-fill' );
    this.waitMsg = $( '.cast-wait-msg' );
}

/**
 * The possible states for the receiver application.
 * @type {{LAUNCHING: string, LOADING: string, BUFFERING: string, PLAYING: string, PAUSED: string, IDLE: string}}
 */
StateManager.State = {
    LAUNCHING: 'LAUNCHING',
    LOADING: 'LOADING',
    BUFFERING: 'BUFFERING',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    IDLE: 'IDLE'
};

/**
 * Sets the new state of the receiver application.
 * @param state
 */
StateManager.prototype.setState = function ( state ) {
    ReceiverLogger.log( "StateManager", "Setting new state for receiver: " + state );
    // Start timeout for the new state
    this.idleManager.setIdleTimeout( state );
    // Save the new state
    this.currState = state;
    // Change the screen according to the new state
    this._handleStateScreen();
};

/**
 * Returning the current state of the receiver application.
 * @returns {*|null}
 */
StateManager.prototype.getState = function () {
    return this.currState;
};

/**
 * Handles first play.
 */
StateManager.prototype.onEditTracks = function () {
    this.waitMsg.fadeIn();
};

/**
 * Display the media metadata UI on screen.
 */
StateManager.prototype.onShowMediaMetadata = function ( showPreview ) {
    if ( this.loadingSpinner.is( ":visible" ) ) {
        this.loadingSpinner.fadeOut();
    }
    this._toggleComponents( (showPreview ? 'show' : 'hide'),
        [ this.mediaInfoContainer, this.beforePlayControls, this.gradient ] );
};

/**
 * Handles first play.
 */
StateManager.prototype.onCanPlay = function () {
    if ( !this.isPlaying ) {
        this.isPlaying = true;
        this._toggleComponents( 'hide', [ this.beforePlayControls, this.mediaInfoContainer, this.gradient ] );
        this.logoDiv.css( 'background', 'transparent' );
    }
};

/**
 * Handles seek start.
 */
StateManager.prototype.onSeekStart = function () {
    if ( this.isPlaying ) {
        this._clearTimeouts();
        if ( this.pauseBtn.is( ":visible" ) ) {
            this._toggleComponents( 'hide', [ this.pauseBtn, this.stateBtnContainer ] );
        }
        if ( !this.inPlayControls.is( ":visible" ) ) {
            this.inPlayControls.fadeIn();
        }
        this.bufferingSpinner.fadeIn();
    }
};

/**
 * Handles seek end.
 */
StateManager.prototype.onSeekEnd = function () {
    if ( this.isPlaying ) {
        this.bufferingSpinner.fadeOut();
        if ( this.currState !== StateManager.State.PAUSED ) {
            this.inPlayControls.fadeOut();
        }
        this._handleStateScreen( true );
    }
};

/**
 * Handles on progress (i.e. updates the progress bar).
 * @param curTime
 * @param totalTime
 */
StateManager.prototype.onProgress = function ( curTime, totalTime ) {
    var formatDuration = function ( dur ) {
        dur = Math.floor( dur );
        function digit( n ) {
            return ('00' + Math.round( n )).slice( -2 );
        }

        var hr = Math.floor( dur / 3600 );
        var min = Math.floor( dur / 60 ) % 60;
        var sec = dur % 60;
        if ( !hr ) {
            return digit( min ) + ':' + digit( sec );
        } else {
            return digit( hr ) + ':' + digit( min ) + ':' + digit( sec );
        }
    };

    if ( !isNaN( curTime ) && !isNaN( totalTime ) ) {
        var pct = (curTime / totalTime);
        var pix = pct * 780;
        this.curTimeDiv.text( formatDuration( curTime ) + ' ' );
        this.totalTimeDiv.text( '/ ' + formatDuration( totalTime ) );
        this.progressFill.css( 'width', pix + 'px' );
    }
};

/**
 * Handle the application UI according to the current state.
 * @param opt_afterSeek - optional parameter which indicates if we just finished to seek.
 * @private
 */
StateManager.prototype._handleStateScreen = function ( opt_afterSeek ) {
    switch ( this.currState ) {
        case StateManager.State.LAUNCHING:
            this._setLogo();
            break;
        case StateManager.State.IDLE:
            this._onIdle();
            break;
        case StateManager.State.LOADING:
            this._onLoading();
            break;
        case StateManager.State.BUFFERING:
            this._onBuffering();
            break;
        case StateManager.State.PLAYING:
            this._onPlaying( opt_afterSeek );
            break;
        case StateManager.State.PAUSED:
            this._onPause( opt_afterSeek );
            break;
        default:
            break;
    }
};

/**
 * Sets the receiver's idle screen logo.
 * If a query string with a logoUrl key added to the
 * receiver application's url it will set it. Else,
 * it will set Kaltura logo.
 * @private
 */
StateManager.prototype._setLogo = function () {
    var logoUrl = getQueryVariable( 'logoUrl' );
    if ( logoUrl ) {
        // Set partner's logo
        ReceiverLogger.log( "StateManager", "Setting partner's logo.", { 'logoUrl': logoUrl } );
        this.logoUrl = logoUrl;
    } else {
        // Set Kaltura's default logo
        ReceiverLogger.log( "StateManager", "Setting Kaltura's logo." );
        this.logoUrl = this.KALTURA_DEFAULT_LOGO_URL;
    }
    this.logoDiv.css( 'background-image', 'url(' + this.logoUrl + ')' );
};

/**
 * BUFFERING state handling.
 * @private
 */
StateManager.prototype._onBuffering = function () {
    if ( this.loadingSpinner.is( ":visible" ) ) {
        this.loadingSpinner.fadeOut();
    }
};

/**
 * LOADING state handling.
 * @private
 */
StateManager.prototype._onLoading = function () {
    this.loadingSpinner.fadeIn();
    this.watermark.fadeOut();
};

/**
 * IDLE state handling.
 * @private
 */
StateManager.prototype._onIdle = function () {
    this.isPlaying = false;
    this.watermark.fadeIn();
    this.logoDiv.css( 'background', '' );
    this.logoDiv.css( 'background-image', 'url(' + this.logoUrl + ')' );
    this.logoDiv.fadeIn();
};

/**
 * PLAYING state handling.
 * @param opt_afterSeek - optional parameter which indicates if we reached this
 * state after seek.
 * @private
 */
StateManager.prototype._onPlaying = function ( opt_afterSeek ) {
    if ( this.isPlaying && !opt_afterSeek ) {
        this._clearTimeouts();
        if ( this.waitMsg.is( ":visible" ) ) {
            this.waitMsg.fadeOut();
        }
        if ( this.pauseBtn.is( ':visible' ) ) {
            this._toggleComponents( 'hide', [ this.pauseBtn, this.stateBtnContainer, this.inPlayControls ] );
        }
        if ( this.isOverlayShown ) {
            this._toggleComponents( 'hide', [ this.mediaInfoContainer, this.gradient ] );
        }
    }
};

/**
 * PAUSE state handling.
 * @param opt_afterSeek - optional parameter which indicates if we reached this
 * state after seek.
 * @private
 */
StateManager.prototype._onPause = function ( opt_afterSeek ) {
    var _this = this;
    this._toggleComponents( 'show', [ this.pauseBtn, this.stateBtnContainer, this.inPlayControls ] );
    if ( opt_afterSeek ) {
        if ( this.isOverlayShown ) {
            this._toggleComponents( 'show', [ this.gradient, this.mediaInfoContainer ] );
            this.pauseTimeout = setTimeout( function () {
                _this._toggleComponents( 'hide', [ _this.gradient, _this.mediaInfoContainer ] );
                _this.isOverlayShown = false;
            }, this.PAUSE_TIMEOUT_DURATION );
        }
    } else {
        this._clearTimeouts();
        this._toggleComponents( 'show', [ this.gradient, this.mediaInfoContainer ] );
        this.isOverlayShown = true;
        this.pauseTimeout = setTimeout( function () {
            _this._toggleComponents( 'hide', [ _this.gradient, _this.mediaInfoContainer ] );
            _this.isOverlayShown = false;
        }, this.PAUSE_TIMEOUT_DURATION );
    }
};

/**
 * Clears all the timeouts because of a change in state.
 * @private
 */
StateManager.prototype._clearTimeouts = function () {
    if ( this.pauseTimeout !== null ) {
        clearTimeout( this.pauseTimeout );
        this.pauseTimeout = null;
    }
};

/**
 * Shows or hides cast UI components.
 * @param selector - 'show' or 'hide'
 * @param components - the UI components
 * @private
 */
StateManager.prototype._toggleComponents = function ( selector, components ) {
    var show = (selector === 'show');
    for ( var i = 0; i < components.length; i++ ) {
        show ? components[ i ].fadeIn() : components[ i ].fadeOut();
    }
};