// Copyright (c) 2022 Siemens

/**
 * Service used for vis viewer functionalities
 *
 * @module js/ssp0VisViewerUtilityService
 */
import appCtxSvc from 'js/appCtxService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import ssp0BackingObjectProviderService from 'js/ssp0BackingObjectProviderService';
import visWebInstanceProvider from 'js/visWebInstanceProvider';

let exports = {};
let sbomViewerInstanceId;
let partsViewerInstanceId;

/**
  * Update Vis Viewer Instance Id
  * @param {String} instanceId instanceId
  * @param {object} data data
  * @param {String} viewerId viewerId
  */
export let updateVisViewerInstanceId = ( instanceId, data, viewerId ) => {
    data.visContext.id = instanceId;
    if (viewerId === servicePlannerConstants.PARTS_VIEWER_INSTANCE_ID) {
        partsViewerInstanceId = instanceId;
        if (appCtxSvc.ctx.clearPartsViewer) {
            clearSceneInViewer(partsViewerInstanceId);
            appCtxSvc.unRegisterCtx('clearPartsViewer');
        }
    } else if (viewerId === servicePlannerConstants.SBOM_VIEWER_INSTANCE_ID) {
        sbomViewerInstanceId = instanceId;
    }
};

/**
  * Get Vis Viewer Instance Id
  * @param {String} viewerId viewerId
  * @returns {String} vis viewer id
  */
export let getVisInstanceId = ( viewerId ) => {
    if (sbomViewerInstanceId && viewerId === servicePlannerConstants.SBOM_VIEWER_INSTANCE_ID) {
        return sbomViewerInstanceId;
    }
    if (partsViewerInstanceId && viewerId === servicePlannerConstants.PARTS_VIEWER_INSTANCE_ID) {
        return partsViewerInstanceId;
    }
    return undefined;
};

/**
  * Clear selection in viewer
  * @param {String} viewerId viewerId
  */
export let clearSelectionInViewer = ( viewerId ) => {
    const viewerInstanceId = getVisInstanceId( viewerId );
    if ( viewerInstanceId !== undefined ) {
        const viewer = visWebInstanceProvider.getVisWebInstance( viewerInstanceId ).Viewer.viewerManager;
        viewer.clearSelection( true );
    }
};

/**
  * Clear scene in viewer
  * @param {String} instanceId instanceId
  */
export let clearSceneInViewer = ( instanceId ) => {
    const viewer = visWebInstanceProvider.getVisWebInstance( instanceId ).Viewer;
    viewer.clearScene();
};

/**
  * Get current visibility state of id
  * @param {Object} vmo viewModelObject
  * @param {String} viewerId viewerId
  * @returns {Object} current visibility state of ID
  */
export let getCurrentVisibilityState = ( vmo, viewerId ) => {
    let currentVisibilityState;

    let bomLineUid = '';
    let tempViewerInstanceId;
    if (viewerId === servicePlannerConstants.PARTS_VIEWER_INSTANCE_ID) {
        bomLineUid = vmo.uid;
        tempViewerInstanceId = partsViewerInstanceId;
    } else {
        const bomLine = ssp0BackingObjectProviderService.getBomLines( [ vmo ] );
        bomLineUid = bomLine[0].uid;
        tempViewerInstanceId = sbomViewerInstanceId;
    }
    const viewer = visWebInstanceProvider.getVisWebInstance( tempViewerInstanceId ).Viewer;
    const visState = viewer.getVisibilityState( bomLineUid );
    currentVisibilityState = visState === 'NONE';

    return {
        currentVisibilityState: currentVisibilityState
    };
};

export default exports = {
    getCurrentVisibilityState,
    clearSelectionInViewer,
    getVisInstanceId,
    updateVisViewerInstanceId
};
