// Copyright (c) 2022 Siemens

/**
 *
 * @module js/senAlignmentTablePropertyRenderer
 */
import compUtil from 'js/senCompareUtils';
import senAlignmentCellRenderer from 'js/senAlignmentCellRenderer';
import dataMgmtService from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import { svgString as headerCompletion } from 'image/headerCompletion16.svg';
import { svgString as headerMismatch } from 'image/headerMismatch16.svg';
import senPLFCellRenderer from 'js/senPLFCellRenderer';

let exports = {};
const  EBOM_CONTEXT = 'ebomContext';
const  SBOM_CONTEXT = 'sbomContext';
/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @param {String} tooltip tooltip names from prpertyRendererTemplates
 *
 */
export let getAssignmentIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let status = compUtil.getStatus( EBOM_CONTEXT, vmo.uid );
    let configIconSources = {
        assignmentIndication: {
            2: 'indicatorAssigned16.svg',
            4: 'indicatorAssigned16.svg',
            5: 'indicatorMultipleAssignmentsError16.svg',
            6: 'indicatorMultipleAssignmentsError16.svg',
            51: 'indicatorPartiallyAssignedByDescendants16.svg',
            52: 'indicatorPartiallyAssignedByDescendants16.svg',
            53: 'indicatorFullyAssignedByDescendantsInOtherScope16.svg',
            54: 'indicatorFullyAssignedByDescendantsInOtherScope16.svg',
            57: 'indicatorPartialQuantityAssigned16.svg',
            58: 'indicatorPartialQuantityAssigned16.svg'
        }
    };
    const ASSIGNMENT_EBOM_CLICKABLE_STATUS = [ 2, 4, 5, 6, 57, 58 ];

    if( configIconSources.assignmentIndication.hasOwnProperty( status ) ) {
        let iconSource = configIconSources[ columnName ][ status ];
        let contextObject = {
            vmo: vmo,
            status: status
        };
        if( status === 57 || status === 58 ) {
            let uids = compUtil.findDifferencesFor( EBOM_CONTEXT, vmo.uid );
            dataMgmtService.loadObjects( uids ).then( function() {
                let assignedObjets = cdm.getObjects( uids );
                dataMgmtService.getProperties( uids, [ 'awb0Quantity' ] ).then( function() {
                    assignedObjets = cdm.getObjects( uids );
                    let assignedQuantity = 0;
                    for( let i = 0; i < assignedObjets.length; i++ ) {
                        assignedQuantity += isNaN( parseInt( assignedObjets[ i ].props.awb0Quantity.dbValues[ 0 ] ) ) ? 1 : parseInt( assignedObjets[ i ].props.awb0Quantity.dbValues[
                            0 ] );
                    }
                    let quantityInfo = {
                        totalQuantity: isNaN( parseInt( vmo.props.awb0Quantity.dbValues[ 0 ] ) ) ? 1 : parseInt( vmo.props.awb0Quantity.dbValues[ 0 ] ),
                        assignedQuantity: assignedQuantity
                    };
                    contextObject.quantityInfo = quantityInfo;
                    let callbackApi = getCallbackApi( EBOM_CONTEXT, vmo, 'sen.assignmentClickEvent' );
                    senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'senQuantityAssgnTooltip', null, callbackApi );
                } );
            } );
        } else {
            let callbackApi = ASSIGNMENT_EBOM_CLICKABLE_STATUS.indexOf( status ) > -1 ? getCallbackApi( EBOM_CONTEXT, vmo, 'sen.assignmentClickEvent' ) : null;
            senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'SenAssignmentTooltip', null, callbackApi );
        }
    }
};


/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @param {String} tooltip tooltip names from prpertyRendererTemplates
 *
 */
export let getMismatchIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let status = compUtil.getStatus( EBOM_CONTEXT, vmo.uid );
    let configIconSources = {
        mismatchIndication: {
            2: 'indicatorMismatch16.svg',
            6: 'indicatorMismatch16.svg',
            52: 'indicatorContainsInnerMismatches16.svg',
            54: 'indicatorContainsInnerMismatches16.svg',
            58: 'indicatorMismatch16.svg'
        }
    };
    if( configIconSources.mismatchIndication.hasOwnProperty( status ) ) {
        let iconSource = configIconSources[ columnName ][ status ];
        let contextObject = {
            vmo: vmo,
            status: status
        };
        senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'SenMismatchTooltip' );
    }
};


/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @param {String} tooltip tooltip names from prpertyRendererTemplates
 *
 */
export let getMismatchOrMissingIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let status = compUtil.getStatus( SBOM_CONTEXT, vmo.uid );
    let configIconSources = {
        mismatchOrMissingIndication: {
            1: 'indicatorMissingInSource16.svg',
            2: 'indicatorMismatch16.svg',
            6: 'indicatorMismatch16.svg',
            55: 'indicatorContainsInnerMismatches16.svg',
            58: 'indicatorMismatch16.svg'
        }
    };
    if( configIconSources.mismatchOrMissingIndication.hasOwnProperty( status ) ) {
        let iconSource = configIconSources[ columnName ][ status ];
        let contextObject = {
            vmo: vmo,
            status: status
        };
        senAlignmentCellRenderer.getIconCellElement( contextObject, 'SenCellIcon', iconSource, containerElement, columnName, 'SenMissingTooltip' );
    }
};

/**
 *
 * @param {String} contextKey contextKey
 * @param {Object} vmo vmo
 * @param {String} eventName eventName
 * @returns {function} function
 */
function getCallbackApi( contextKey, vmo, eventName ) {
    return function( event ) {
        let eventData = {
            vmo: vmo,
            contextName: contextKey,
            event:event
        };
        eventBus.publish( eventName, eventData );
    };
}

/**
 *
 * @param {String} resource resource name
 * @param {String} key key
 * @param {Array} params param
 * @returns {String} message
 */
function getTooltipData( resource, key, params ) {
    return localeService.getLocalizedText( resource, key ).then( function( msg ) {
        msg && params && params.forEach( function( item, index ) {
            msg = msg.replace( `{${index}}`, params[index] );
        } );
        return msg;
    } );
}

/**
  * Appends mismatch, missign and assignment header indications to the container element.
  * @param {DOMElement} containerElement containerElement
  * @param {Object} columnName the column associated with the cell
  *
  */
export let getAlignmentColumnHeaderRenderer = function( containerElement, columnName ) {
    let imagePath;
    let altText;
    if( columnName === 'assignmentIndication' ) {
        imagePath = headerCompletion;
        altText = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'assignmentColumnTitle', null );
    } else if( columnName === 'mismatchIndication' ) {
        imagePath = headerMismatch;
        altText = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'mismatchColumnTitle', null );
    } else{
        imagePath = headerMismatch;
        altText = senPLFCellRenderer.getLocalizedMessage( 'senMessages', 'mismatchOrMissingColumnTitle', null );
    }

    let iconElement = document.createElement( 'span' );
    iconElement.className = 'aw-sen-header-visual-indicator';
    iconElement.innerHTML = imagePath;
    iconElement.title = altText;

    if( iconElement !== null ) {
        containerElement.appendChild( iconElement );
    }
};

export default exports = {
    getAssignmentIndicationRenderer,
    getMismatchIndicationRenderer,
    getMismatchOrMissingIndicationRenderer,
    getTooltipData,
    getAlignmentColumnHeaderRenderer
};
