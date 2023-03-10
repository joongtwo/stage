// Copyright (c) 2022 Siemens

/**
 * This Motion service provider
 *
 * @module js/viewerMotionManagerProvider
 */

import viewerContextService from 'js/viewerContext.service';
import _ from 'lodash';
import assert from 'assert';
import '@swf/ClientViewer';

/**
 * Provides an instance of viewer Motion manager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 *
 * @return {ViewerMotionManager} Returns viewer Motion manager
 */
let getViewerMotionManager = function( viewerView, viewerContextData ) {
    return new ViewerMotionManager( viewerView, viewerContextData );
};

const EXPLODED_VIEW_MODE_DISTANCE = 0;
const EXPLODED_VIEW_PERCENT_MIN = 0;
const EXPLODED_VIEW_PERCENT_MAX = 100;

/**
 * Class to hold the viewer Motion data
 */
class ViewerMotionManager {
    /**
     * ViewerMotionManager class constructor
     *
     * @constructor ViewerMotionManager
     *
     * @param {Object} viewerView Viewer view
     * @param {Object} viewerContextData Viewer Context data
     */
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null' );
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
        this.initialize();
        this.setupAtomicDataTopics();
    }
   /**
     * Initialize ViewerMotionManager
     */
    initialize() {
        this.setExplodeViewMode(EXPLODED_VIEW_MODE_DISTANCE);
        this.isExplodeViewActive = false;
    }
    /**
     * setupAtomicDataTopics ViewerMotionManager
     */
    setupAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_COMMAND_PANEL_LAUNCHED, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.CLEANUP_3D_VIEWER, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_CAPTURE_SNAPSHOT_BEGIN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_CREATE_SECTION_BEGIN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_CREATE_MARKUP_BEGIN, this );

    }

    /**
     * Set explode View Mode Distance/Volume/Radial
     *
     * @param {Number} explodeMode Explode view mode. i.e Distance = 0 ,volume = 1, Radial =2
     */
    setExplodeViewMode( explodeMode ) {
        if( this.viewerView && this.viewerView.motionMgr ) {
            this.viewerView.motionMgr.setExplodedViewMode( explodeMode );
        }
    }

    /**
     * Set explode mode enabled or disabled
     *
     * @param {boolean} isEnabled should Exploded view be enabled
     */
    setExplodeViewEnabled( isEnabled ) {
        if( this.viewerView && this.viewerView.motionMgr ) {
            this.viewerView.motionMgr.setExplodedView( isEnabled );
            this.isExplodeViewActive = isEnabled;
        }
    }

    /**
     * Set explode view percent
     *
     * @param {Number} explodePercent set Exploded view percent
     */
    setExplodeViewPercent( explodePercent ) {
        if( this.viewerView && this.viewerView.motionMgr && explodePercent >= EXPLODED_VIEW_PERCENT_MIN && explodePercent <= EXPLODED_VIEW_PERCENT_MAX ) {
            this.viewerView.motionMgr.setExplodedViewPercent( explodePercent / 100 );
        }
    }

    /**
     * Reset Explode view Percentage
     *
     */
     resetExplodeView() {
        this.setExplodeViewPercent( EXPLODED_VIEW_PERCENT_MIN );
    }

    /**
     * Start Explode view Mode in viewer
     */
    startExplodeViewMode() {
        this.setExplodeViewEnabled( true );
        this.resetExplodeView();
    }

    /**
     * Close Explode view mode in viewer
     *
     * @param {Promise} deferred - promise from calling function to be resolved. Will be removed in future
     */
    closeExplodeViewMode() {
        this.resetExplodeView();
        this.setExplodeViewEnabled( false );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     */
    update( topic ) {
        if( this.isExplodeViewActive ) {
            if( topic === this.viewerContextData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS ||
                topic === viewerContextService.VIEWER_COMMAND_PANEL_LAUNCHED ) {
                this.disableExplodeView();
            } else if( topic === viewerContextService.VIEWER_CREATE_SECTION_BEGIN ||
                topic === viewerContextService.VIEWER_CREATE_MARKUP_BEGIN ||
                topic === viewerContextService.VIEWER_CAPTURE_SNAPSHOT_BEGIN  ) {
                this.disableExplodeView();
            }else if( topic ===  this.viewerContextData.CLEANUP_3D_VIEWER ) {
                this.disableExplodeView();
            }
        }
    }

    /**
     * disable Explode View
     */
    disableExplodeView() {
        this.closeExplodeViewMode();
        this.viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE, false );
    }
}

export default {
    getViewerMotionManager
};
