// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import WorkinstrSnapshotViewerData from 'js/workinstrSnapshotViewerData';
import awIconService from 'js/awIconService';
import AwImage from 'viewmodel/AwImageViewModel';
import { ShowWhen } from 'js/hocCollection';
const DivShowWhen = ShowWhen( 'div' );
import { ExistWhen } from 'js/hocCollection';
const DivExistWhen = ExistWhen( 'div' );
import AwToolbar from 'viewmodel/AwToolbarViewModel';
import appCtxSvc from 'js/appCtxService';
/**
 *
 * @param {Object} viewerContextObject viewerContextObject
 * @returns {String}  thumbnail url
 */
function setThumbnailUrl( viewerContextObject ) {
    return awIconService.getThumbnailFileUrl( viewerContextObject );
}

/**
 *
 * @param {Object} subPanelContext subPanelContext
 * @param {Boolean} isReloadViewer isReloadViewer
 * @param {Boolean} viewerAtomicData viewerAtomicData
 * @returns {Object} Object
 */
function initializeSnapshotViewer( subPanelContext, isReloadViewer, viewerAtomicData ) {
    let workinstrViewerInstance = new WorkinstrSnapshotViewerData();
    return workinstrViewerInstance.initializeSnapshotViewer( subPanelContext, viewerAtomicData, isReloadViewer ).then( viewerInstance=>{
        setCommandContext( subPanelContext, viewerAtomicData );
        return viewerInstance;
    } );
}

/**
 *
 * @param {Object} workinstrVieweInstance  workinstrVieweInstance
 * @param {Object} subPanelContext  subPanelContext
 */
function reload3DViewer( workinstrVieweInstance, subPanelContext ) {
    if ( workinstrVieweInstance && workinstrVieweInstance.reload3DViewer && typeof workinstrVieweInstance.reload3DViewer === 'function' ) {
        setCommandContext( subPanelContext, null );
        workinstrVieweInstance.reload3DViewer( subPanelContext ).then( ()=>{
            setCommandContext( subPanelContext, workinstrVieweInstance.getViewerAtomicData() );
        } );
    }
}

/**
 *
 * @param {Object} workinstrVieweInstance workinstrVieweInstance
 * @param {Object} eventData eventData
 */
function onWorkinstrSelectionChange( workinstrVieweInstance, eventData ) {
    if( eventData.activeTab.tabKey === 'Parts' || eventData.activeTab.tabKey === 'Tools' ) {
        let selectedObjects = eventData.dataProvider.selectedObjects;
        workinstrVieweInstance.updateSelection( selectedObjects );
    }
}

/***
 * @param {Object} subPanelContext subPanelContext
 * @param {Object} viewerAtomicData viewerAtomicData
 */
function setCommandContext( subPanelContext, viewerAtomicData ) {
    if( subPanelContext && subPanelContext.tabModel ) {
        const newData = subPanelContext.tabModel.getValue();
        newData.viewerAtomicData = viewerAtomicData;
        newData.viewerContextData = viewerAtomicData.viewerCtxData;
        subPanelContext.tabModel.update( { ...newData } );
    }
}

/**
 * Snapshot Viewer Render Function
 *@param {Object} props props
 * @returns {Object} dom element
 */
export function snapshotViewerRenderFn( props ) {
    let loadingMessage = <div className='aw-jswidgets-text'>{props.viewModel.i18n.LOADING_TEXT}</div>;

    let thumbnailUrl = props.viewModel && props.viewModel.data ? props.viewModel.data.thumbnailUrl : null;
    let thumbNailElement = <div className='aw-viewer-viewThumbnailContainer aw-threeDViewer-viewer3DChildContainer' >
        <AwImage source={thumbnailUrl}></AwImage>
    </div>;
    let viewerProgressElement = <div className='aw-viewer-viewLoadProgressContainer aw-threeDViewer-loadProgressContainer'>
        <div className='aw-viewer-loadProgress aw-threeDViewer-loadProgress'></div>
    </div>;

    let viewerEmmProgressElement = <div ng-show='showViewerEmmProgress' className='aw-viewer-viewEmmLoadProgressContainer aw-threeDViewer-emmLoadProgressContainer'>
        <div className='aw-viewer-emmLoadProgress aw-threeDViewer-emmLoadProgress' ></div>
    </div>;

    let viewerCtxData = props.viewModel.data.workInstrViewerInstance ? props.viewModel.data.workInstrViewerInstance.viewerCtxData : null;


    return (
        <div id='workinstrSnapshotViewer' className='aw-workinstr-viewerStyle aw-viewerjs-innerContent'>
            <DivExistWhen existWhen={props.viewerAtomicData.isSubCommandsToolbarVisible}>
                <AwToolbar firstAnchor='aw_3dViewerSubCommandsFirstAnchor' secondAnchor='aw_3dViewerSubCommandsSecondAnchor' orientation='HORIZONTAL' context={{ viewerContextData : viewerCtxData, viewerAtomicData:props.viewerAtomicData }}></AwToolbar>
            </DivExistWhen>
            {props.viewerAtomicData.loadingViewer && thumbnailUrl ? loadingMessage : ''}
            {props.viewerAtomicData.loadingViewer && thumbnailUrl ? thumbNailElement : ''}
            <div id='imageCaptureContainer'></div>
            {props.viewerAtomicData.showViewerProgress  ? viewerProgressElement : ''}
            {props.viewerAtomicData.showViewerEmmProgress && !props.viewerAtomicData.showViewerProgress ? viewerEmmProgressElement : ''}
            <DivShowWhen id={'awNativeViewer'} showWhen={!props.viewerAtomicData.displayImageCapture}></DivShowWhen>
        </div>
    );
}
/**
 *
 * @param {String} contextNameSpace contextNameSpace
 * @param {String} propertyName propertyName
 * @param {any} propertyValue propertyValue
 */
function updateViewerContextData( contextNameSpace, propertyName, propertyValue ) {
    appCtxSvc.updatePartialCtx( contextNameSpace + '.' + propertyName, propertyValue );
}

export default {
    snapshotViewerRenderFn,
    initializeSnapshotViewer,
    setThumbnailUrl,
    reload3DViewer,
    onWorkinstrSelectionChange,
    updateViewerContextData,
    setCommandContext
};
