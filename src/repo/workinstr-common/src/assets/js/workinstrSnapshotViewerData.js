import workinstrSnapshotService from 'js/workinstrSnapshotService';
import logger from 'js/logger';
import eventBus from 'js/eventBus';
import imgViewerExport from 'js/ImgViewer';
import AwTimeoutService from 'js/awTimeoutService';
import awPromiseService from 'js/awPromiseService';
import AwWindowService from 'js/awWindowService';
import viewerCtxSvc from 'js/viewerContext.service';

export default class WorkinstrSnapshotViewerData {
    constructor(  ) {
        this.viewerAtomicData = null;
        this.viewerCtxData = null;
        this.viewerCanvasDivElement = null;
        this.viewerRef = null;
        this.viewerContainer = null;
        this.viewerElement = null;
    }

    /**
     *
     * @param {*} subPanelContext subPanelContext
     * @param {*} viewerAtomicData viewerAtomicData
     * @param {*} isReloadViewer isReloadViewer
     * @returns {Object}  object of WorkinstrSnapshotViewerData
     */
    initializeSnapshotViewer( subPanelContext, viewerAtomicData, isReloadViewer ) {
        this.viewerAtomicData = viewerAtomicData;
        this.setViewerLoadingStatus( true );
        this.viewerRef = subPanelContext.viewerRef;
        let viewerContextObj = subPanelContext.fileData.file;
        this.viewerContainer  = this.getElementById( 'workinstrSnapshotViewer' );
        this.viewerImageCaptureContainer = this.getElementById( 'imageCaptureContainer' );
        this.viewerElement = this.getElementById( 'awNativeViewer' );
        if( isReloadViewer || !workinstrSnapshotService.isSameProductOpenedAsPrevious( viewerContextObj ) ) {
            if( workinstrSnapshotService.isSameContextNamespaceAsPrevious( viewerContextObj ) ) {
                workinstrSnapshotService.cleanUpPreviousView();
            }

            let width = this.getViewerWidth( );
            let height = this.getViewerHeight( );
            return workinstrSnapshotService.getViewerLoadInputParameter( viewerContextObj, width, height, viewerAtomicData ).then( ( viewerLoadInputParams )=> {
                viewerLoadInputParams.setViewerAtomicData( viewerAtomicData );
                viewerLoadInputParams.initializeViewerContext();
                this.viewerCtxData = viewerLoadInputParams.getViewerContext();
                this.updateViewerAtomicData( 'viewerCtxData',  this.viewerCtxData );
                this.registerForConnectionProblems();
                return workinstrSnapshotService.getViewerView( viewerLoadInputParams ).then( ( viewerData )=> {
                    this.setupViewerAfterLoad( viewerData, viewerContextObj );

                    this.setViewerLoadingStatus( false );
                    this.updateShowEmmProgress( false );
                    this.set3DViewerSize();
                    this.resigterForWindowResizeEvent();
                    this.resigterViewerForParentResize();
                    return this;
                }, ( errorMsg )=> {
                    logger.error( 'Failed to load viewer : ' + errorMsg );
                    this.setViewerLoadingStatus( false );
                    this.updateShowEmmProgress( false );
                    return errorMsg;
                } );
            } );
        }

        return workinstrSnapshotService.restorePreviousView().then( ( viewerData )=> {
            this.setupViewerAfterLoad( viewerData, viewerContextObj );
            this.registerForConnectionProblems( );
            this.setViewerLoadingStatus( false );
            this.updateShowEmmProgress( false );
            this.set3DViewerSize();
            return this;
        }, ( errorMsg ) => {
            logger.error( 'Failed to load viewer : ' + errorMsg );
            this.setViewerLoadingStatus( false );
            this.updateShowEmmProgress( false );
            return errorMsg;
        } );
    }

    /**
     * @param {Object} viewerData viewer Data
     * @param {Object} viewerContextObj viewer context data object
                     */
    setupViewerAfterLoad(  viewerData, viewerContextObj ) {
        if( this.viewerCanvasDivElement ) {
            this.viewerCanvasDivElement.remove();
        }
        this.viewerCanvasDivElement = viewerData[ 1 ];
        this.viewerElement.append( this.viewerCanvasDivElement );
        this.viewerCtxData = viewerData[ 0 ];
        this.viewerCtxData.setZoomReversed( true );
        this.viewerCtxData.getSelectionManager().setSelectionEnabled( true );
        this.viewerCtxData.updateCurrentViewerProductContext( viewerContextObj );
        this.updateViewerAtomicData( 'viewerCtxData',  this.viewerCtxData );
        this.setupAtomicDataTopics();
    }

    /**
     * Register for viewer atomic data topics
     */
    setupAtomicDataTopics() {
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY, this );
    }

    /**
     * deregister for atomic data topics
     */
    unregisterAtomicDataTopics() {
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic, data ) {
        if( topic === viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE ) {
            this.displayImageCapture( data.fileUrl, true );
        } else if ( topic === viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY ) {
            this.displayImageCapture( null, false );
        }
    }

    /**
     * Register for viewer resize events
     */
    resigterForWindowResizeEvent() {
        let self = this;
        // Handle Window resize event
        AwWindowService.instance.onresize = function() {
            self.set3DViewerSize();
        };
    }

    /**
     * Register for viewer resize events
     */
    resigterViewerForParentResize() {
        let self = this;
        const ContentResizeObserver = window.ResizeObserver;
        if( ContentResizeObserver && self.viewerContainer ) {
            self.divResizeobserver = new ContentResizeObserver( ()=>{
                self.set3DViewerSize();
            } );
            self.divResizeobserver.observe( self.viewerContainer );
        }
    }
    /**
     * Register for viewer visibility events
     */
    registerForConnectionProblems(  ) {
        this.viewerCtxData.addViewerConnectionProblemListener( this.notifyViewerReload, this  );
    }

    handle3DViewerConnectionProblem() {
        this.notifyViewerReload();
    }
    notifyViewerReload() {
        eventBus.publish( 'workinstr.reLoad3dViewer', { viewerContext: this.viewerCtxData.getViewerCtxNamespace() } );
    }
    /**
     *
     * @param {Object} subPanelContext  subPanelContext
     * @returns {Object} workInstrViewerData instance
     */
    reload3DViewer( subPanelContext ) {
        if ( this.loading ) {
            return awPromiseService.instance.reject( 'Already loading!' );
        }
        this.cleanUp( true );
        this.setViewerLoadingStatus( true );
        this.updateViewerAtomicData( 'isSubCommandsToolbarVisible', false );
        return this.initializeSnapshotViewer( subPanelContext, this.viewerAtomicData, true );
    }
    /**
     *
     * @returns
     */
    getViewerAtomicData() {
        return this.viewerAtomicData;
    }
    /**
     * Set 3d viewer loading status
     * @param {Boolean} isLoading is viewer loading
     */
    setViewerLoadingStatus( isLoading ) {
        this.isLoading = isLoading;
        this.updateViewerAtomicData( 'loadingViewer', isLoading );
    }
    /**
     *
     * @param {boolean} showEmmProgress showEmmProgress
     */
    updateShowEmmProgress( showEmmProgress ) {
        this.updateViewerAtomicData( 'showViewerEmmProgress', showEmmProgress );
    }
    /**
     *
     * @param {boolean} showProgress showProgress
     */
    updateShowViewerProgress(  showProgress ) {
        this.updateViewerAtomicData( 'showViewerProgress', showProgress );
    }
    /**
     * update viewer atomic data
     * @param {Object} propertyPath path of property on atomic data value
     * @param {Object} propertyValue vlaue to be set on that path
     */
    updateViewerAtomicData( propertyPath, propertyValue ) {
        const newViewerAtomicData = { ...this.viewerAtomicData.getValue() };
        newViewerAtomicData[propertyPath] = propertyValue;
        this.viewerAtomicData.update( newViewerAtomicData );
    }

    updateSelection( selectedObjects ) {
        if( selectedObjects && selectedObjects.length > 0 ) {
            let selectedPartCsid = workinstrSnapshotService.getCloneStableId( selectedObjects[0] );
            if(  selectedPartCsid !== null && selectedPartCsid !== '' ) {
                this.viewerCtxData.getSelectionManager().selectPartsInViewer( [ selectedPartCsid ] );
            }
        } else {
            this.viewerCtxData.getSelectionManager().selectPartsInViewer();
        }
    }
    /**
     * Display image capture upon trigger of image capture event.
     *
     * @param {String} fileUrl - Image capture url.
     * @param {boolean} activateImageCapture - activate if true otherwise deactivate.
     */
    displayImageCapture( fileUrl, activateImageCapture ) {
        let displayImageCapture = 'displayImageCapture';
        if ( activateImageCapture ) {
            if( fileUrl ) {
                this.updateViewerAtomicData( displayImageCapture, true );
                this.viewerImageCaptureContainer.innerHTML = '';
                this.viewerImageCaptureContainer.setAttribute( 'class', 'aw-imageviewer-viewer aw-viewerjs-innerContent' );
                const imgViewer = imgViewerExport.newInstance( this.viewerImageCaptureContainer );
                this.viewerImageCaptureContainer.imgViewer = imgViewer;
                this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.IMAGE_CAPTURE_CONTAINER, this.viewerImageCaptureContainer );
                imgViewer.setImage( fileUrl );
            } else {
                logger.error( 'Failed to display image capture due to missing image url.' );
                this.updateViewerAtomicData( displayImageCapture, false );
            }
        } else {
            this.updateViewerAtomicData( displayImageCapture, false );
            this.viewerImageCaptureContainer.setAttribute( 'class', '' );
            this.viewerImageCaptureContainer.innerHTML = '';
        }
    }

    /**
     * @param {String} elementId elementId
     * @returns {Object} element
     */
    getElementById( elementId ) {
        return this.viewerRef.current.querySelector(  'div#' + elementId );
    }

    /**
     *
     * @returns {String} width
     */
    getViewerWidth(  ) {
        return this.viewerContainer.clientWidth;
    }

    /**
     *
     * @returns {String} height
     */
    getViewerHeight(  ) {
        return this.viewerContainer.clientHeight;
    }

    set3DViewerSize() {
        let self = this;
        if ( this.resizeTimeoutPromise ) {
            AwTimeoutService.instance.cancel( this.resizeTimeoutPromise );
        }
        this.resizeTimeoutPromise = AwTimeoutService.instance( function() {
            self.resizeTimeoutPromise = null;
            if ( self.viewerCtxData ) {
                self.viewerCtxData.setSize( self.getViewerWidth(), self.getViewerHeight() );
            }
        }, 250 );
    }
    /**
 * Clean up the directive
 * @param {Boolean} isReloadViewer boolean indicating if the cleanup is for reload
 */
    cleanUp(  isReloadViewer ) {
        if( this.viewerCtxData ) {
            workinstrSnapshotService.updateViewerVisibility( this.viewerCtxData.getViewerCtxNamespace(), false );
        }

        if( isReloadViewer ) {
            if( this.viewerCanvasDivElement && this.viewerCanvasDivElement.parentNode ) {
                this.viewerCanvasDivElement.parentNode.removeChild( this.viewerCanvasDivElement );
            }
        }
        if ( this.divResizeobserver ) {
            this.divResizeobserver.disconnect();
        }
        this.viewerCtxData.removeViewerConnectionProblemListener( this.notifyViewerReload );
        this.unregisterAtomicDataTopics();
    }
}
