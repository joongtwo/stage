// Copyright (c) 2022 Siemens

/**
 * Service for ep External Flows Indication table column renderer
 *
 * @module js/epExternalFlowIndicationTablePropertyRenderer
 */
import { getBaseUrlPath } from 'app';
import epTableCellRenderer from 'js/epTableCellRenderer';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';

/**
 * Render External Flow indication.
 * Calls methods to get icon image source and icon element.
 * Appends it to the container element.
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
export function rendererForExternalFlowIndication( vmo, containerElement ) {
    if( !containerElement ) {
        return;
    }
    let selectedPertNodes = [];
    const graph = appCtxSvc.getCtx('graph');
    if(graph && graph.graphModel){
        const selectedNodes = graph.graphModel.graphControl.getSelected('Node');
        if (selectedNodes) {
            selectedPertNodes = selectedNodes.map(node => node.model.nodeObject);
        }
    }else{
        selectedPertNodes = appCtxSvc.getCtx('EP_PROCESS_TREE_TABLE_EDIT_CONTEXT').getDataSource().getDataProvider().selectedObjects;
    }
    if( selectedPertNodes && selectedPertNodes.length > 0 ) {
        const ExternalPredecessorsForSelectedPertNode = epObjectPropertyCacheService.getProperty( selectedPertNodes[ 0 ].uid, 'ExternalPredecessors' );
        const ExternalSuccessorsForSelectedPertNode = epObjectPropertyCacheService.getProperty( selectedPertNodes[ 0 ].uid, 'ExternalSuccessors' );
        let isCurrentObjectPredecessorForSelectedPertNode = null;
        if( ExternalPredecessorsForSelectedPertNode.includes( vmo.uid ) ) {
            isCurrentObjectPredecessorForSelectedPertNode = true;
        } else if( ExternalSuccessorsForSelectedPertNode.includes( vmo.uid ) ) {
            isCurrentObjectPredecessorForSelectedPertNode = false;
        }
        rendererExternalNodeIndication( containerElement, isCurrentObjectPredecessorForSelectedPertNode, vmo );
    }
}

/**
 * Renders external predecessor or successor icon for given node in table
 * @param {DomElement} containerElement - the container element
 * @param {boolean} isMissingInSrc -true if it is missing in source
 * @param {Object} vmo -VMO of the selection
 */
function rendererExternalNodeIndication( containerElement, isCurrentObjectPredecessorForSelectedPertNode, vmo ) {
    const iconSource = getIconSource( isCurrentObjectPredecessorForSelectedPertNode );
    const iconClass = 'aw-ep-tableCellindicator';
    const localTextBundle = localeService.getLoadedText( 'PertMessages' );
    if( iconSource ) {
        let iconElement = epTableCellRenderer.setIconCellElement( iconSource, containerElement, iconClass );
        if( iconElement !== null ) {
            iconElement.title = isCurrentObjectPredecessorForSelectedPertNode ? localTextBundle.externalPredecessorTooltip : localTextBundle.externalSuccessorTooltip;
            containerElement.appendChild( iconElement );
        }
    }
}

/**
 * Gets icon image source
 * @param {boolean} isCurrentObjectPredecessorForSelectedPertNode - true if given object is predecessor for selected pert node
 * @return {String} image source
 */
function getIconSource( isCurrentObjectPredecessorForSelectedPertNode ) {
    let iconName = isCurrentObjectPredecessorForSelectedPertNode ? 'indicatorHasExternalPredecessors16.svg' : 'indicatorHasExternalSuccessors16.svg';
    return `${getBaseUrlPath()}/image/${iconName}`;
}

/**
 * Renderer External Flow column header
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} tooltip - tooltip object
 * @param {Object} column - column object
 */
 function renderExternalFlowColumnHeader( containerElement, columnField, tooltip, column ) {
    epTableCellRenderer.columnHeaderIndicationRenderer( containerElement, columnField, column );
}

let exports;
export default exports = {
    rendererForExternalFlowIndication,
    renderExternalFlowColumnHeader
};
