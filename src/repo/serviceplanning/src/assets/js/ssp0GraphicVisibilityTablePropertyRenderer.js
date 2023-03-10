// Copyright (c) 2022 Siemens

/**
 * Service for ep graphic visibility table column renderer
 *
 * @module js/ssp0GraphicVisibilityTablePropertyRenderer
 */
import { getBaseUrlPath } from 'app';
import { constants as mfeVisConstants } from 'js/constants/mfeVisConstants';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import { svgString as miscInProcessIndicator } from 'image/miscInProcessIndicator16.svg';
import ssp0BackingObjectProviderService from 'js/ssp0BackingObjectProviderService';
import ssp0TableCellRenderer from 'js/ssp0TableCellRenderer';
import ssp0VisViewerUtilityService from 'js/ssp0VisViewerUtilityService';
import visWebInstanceProvider from 'js/visWebInstanceProvider';

let exports;

/**
 * Gets icon image source based on parameters given
 *
 * @param {String} iconType - the icon type to get its image file
 *
 * @return {String} image source
 */
function getIconSource( iconType ) {
    let cellImg = getBaseUrlPath();
    if( cellImg !== null ) {
        switch ( iconType ) {
            case mfeVisConstants.VISIBILITY_STATUS.LOADING:
                cellImg = `data:image/svg+xml;charset=UTF-8,${miscInProcessIndicator.replaceAll( '#', '%23' )}`;
                break;
            case mfeVisConstants.VISIBILITY_STATUS.SOME:
                cellImg += '/image/indicatorPartiallyShown16.svg';
                break;
            case mfeVisConstants.VISIBILITY_STATUS.NO_JT:
            case mfeVisConstants.VISIBILITY_STATUS.NONE:
                cellImg += '/image/indicatorHidden16.svg';
                break;
            case mfeVisConstants.VISIBILITY_STATUS.ALL:
                cellImg += '/image/indicatorShown16.svg';
        }
    }
    return cellImg;
}

/**
 * Render graphic visibility indication in Parts Viewer of Parts.
 * Calls methods to get icon image source and icon element.
 * Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function rendererGraphicVisibilityIndicationBasedOnPartsViewer( vmo, containerElement ) {
    _propertyRendererBasedOnPartsViewer( servicePlannerConstants.PARTS_VIEWER_INSTANCE_ID, vmo, containerElement, servicePlannerConstants.PARTS_GRAPHICS_VISIBILITY_TOGGLE_EVENT );
}

/**
 * Render graphic visibility indication in Parts Viewer of Service Plan.
 * Calls methods to get icon image source and icon element.
 * Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function rendererSPGraphicVisibilityIndicationBasedOnPartsViewer( vmo, containerElement ) {
    _propertyRendererBasedOnPartsViewer( servicePlannerConstants.PARTS_VIEWER_INSTANCE_ID, vmo, containerElement, servicePlannerConstants.SP_PARTS_GRAPHICS_VISIBILITY_TOGGLE_EVENT );
}

let _propertyRendererBasedOnPartsViewer = function( instanceId, vmo, containerElement, eventName ) {
    if( !containerElement || !vmo.uid ) {
        return;
    }
    let visibilityState = 'NONE';
    const viewerInstanceId = ssp0VisViewerUtilityService.getVisInstanceId( instanceId );
    if ( instanceId === servicePlannerConstants.PARTS_VIEWER_INSTANCE_ID && viewerInstanceId ) {
        const viewer = visWebInstanceProvider.getVisWebInstance( viewerInstanceId ).Viewer;
        visibilityState = viewer.getVisibilityState( vmo.uid );
    }
    if ( instanceId === servicePlannerConstants.SBOM_VIEWER_INSTANCE_ID && viewerInstanceId ) {
        const viewer = visWebInstanceProvider.getVisWebInstance( viewerInstanceId ).Viewer;
        const bomLineUid = ssp0BackingObjectProviderService.getBomLines( [ vmo ] );
        visibilityState = viewer.getVisibilityState( bomLineUid[ 0 ].uid );
    }
    const iconSource = getIconSource( visibilityState );
    if( iconSource ) {
        vmo.graphicsVisibilityContainerElement = containerElement;
        const iconClass = visibilityState === mfeVisConstants.VISIBILITY_STATUS.NO_JT ?
            [ servicePlannerConstants.TABLE_CELL_INDICATOR_CLASS, servicePlannerConstants.INDICATOR_HIDDEN_CLASS ] : [ servicePlannerConstants.TABLE_CELL_INDICATOR_CLASS ];
        const element = ssp0TableCellRenderer.setIconCellElement( iconSource, containerElement, iconClass );
        // eslint-disable-next-line space-in-parens
        ssp0TableCellRenderer.addClickHandlerToElement( vmo, vmo.graphicsVisibilityToggleEventName ? vmo.graphicsVisibilityToggleEventName : eventName, element, visibilityState );
    }
};

/**
 * Render graphic visibility indication in SBOM Viewer.
 * Calls methods to get icon image source and icon element.
 * Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function rendererGraphicVisibilityIndicationBasedOnSBOMViewer( vmo, containerElement ) {
    _propertyRendererBasedOnPartsViewer( servicePlannerConstants.SBOM_VIEWER_INSTANCE_ID, vmo, containerElement, servicePlannerConstants.GRAPHICS_VISIBILITY_TOGGLE_EVENT );
}

/**
 * Render graphic visibility indication in Viewer.
 * Calls methods to get icon image source and icon element.
 *
 * For details table, we are not getting correct VMOs everytime.
 * So need to directly access epSingleVisViewerService cache.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function rendererLoadingGraphicVisibilityIndicationBasedOnViewer( vmo, containerElement ) {
    if( !containerElement || !vmo.uid ) {
        return;
    }
    let visibilityState = 'LOADING';
    const iconSource = getIconSource( visibilityState );
    if( iconSource ) {
        vmo.graphicsVisibilityContainerElement = containerElement;
        const iconClass = visibilityState === mfeVisConstants.VISIBILITY_STATUS.NO_JT ?
            [ servicePlannerConstants.TABLE_CELL_INDICATOR_CLASS, servicePlannerConstants.INDICATOR_HIDDEN_CLASS ] : [ servicePlannerConstants.TABLE_CELL_INDICATOR_CLASS ];
        ssp0TableCellRenderer.setIconCellElement( iconSource, containerElement, iconClass );
    }
}

export default exports = {
    rendererSPGraphicVisibilityIndicationBasedOnPartsViewer,
    rendererGraphicVisibilityIndicationBasedOnPartsViewer,
    rendererGraphicVisibilityIndicationBasedOnSBOMViewer,
    rendererLoadingGraphicVisibilityIndicationBasedOnViewer
};
