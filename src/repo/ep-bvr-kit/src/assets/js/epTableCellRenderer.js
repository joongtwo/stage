// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for ep table custom table column cell
 *
 * @module js/epTableCellRenderer
 */

import eventBus from 'js/eventBus';
import { svgString as miscTableHeaderInWorkflow } from 'image/miscTableHeaderInWorkflow16.svg';
import { svgString as miscTableHeaderDisplayState } from 'image/miscTableHeaderDisplayState16.svg';
import { svgString as headerCompletion } from 'image/headerCompletion16.svg';
import { svgString as headerMismatch } from 'image/headerMismatch16.svg';
import { svgString as miscTableHeaderHasExternalDependencies } from 'image/miscTableHeaderHasExternalDependencies16.svg';
import htmlUtil from 'js/htmlUtils';
import tableSvc from 'js/published/splmTablePublishedService';

/**
 * Create the icon in the cell element
 *
 * @param {String} iconURL - path of image
 * @param {DOMElement} containerElement - the container element
 * @param {Boolean} isTypeIcon - is the icon is type icon and not indicator
 */
export function setIconCellElement( iconURL, containerElement, iconClass ) {
    let cellImgElement = containerElement.getElementsByTagName( 'img' );
    if( cellImgElement.length === 0 ) {
        cellImgElement = htmlUtil.createElement( 'img', tableSvc.CLASS_ICON_BASE );
        containerElement.appendChild( cellImgElement );
    } else {
        cellImgElement = cellImgElement[0];
    }
    cellImgElement.src = iconURL;
    cellImgElement.classList.add( ...iconClass );
    return cellImgElement;
}

/**
 * Add click handler to the cell container element
 *
 * @param {DOMElement} vmo - the row object
 * @param {String} eventName - the name of event to publish
 */
export function addClickHandlerToElement( vmo, eventName, element ) {
    if( element ) {
        element.addEventListener( 'click', function( event ) {
            event.stopImmediatePropagation();
            const eventData = {
                vmo: vmo,
                event: event
            };
            eventBus.publish( eventName, eventData );
        } );
    }
}

/**
 * Remove the icon from the cell element
 *
 * @param {DOMElement} containerElement - the container element
 */
export function removeIconCellElement( containerElement ) {
    let cellImgElement = containerElement.getElementsByTagName( 'img' );
    if( containerElement.length > 0 ) {
        containerElement.removeChild( cellImgElement[0] );
    }
}

/**
 * Renderer for column header indications
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} column - column object
 */
export function columnHeaderIndicationRenderer( containerElement, columnField, column ) {
    let headerContent = document.createElement( 'div' );
    headerContent.className = 'aw-splm-tableCellTop';
    let objectIcon = document.createElement( 'div' );
    objectIcon.className = 'aw-visual-indicator';
    objectIcon.title = column.propertyDisplayName;
    switch( columnField ) {
        case 'graphicVisibility':
            objectIcon.innerHTML = miscTableHeaderDisplayState;
            break;
        case 'releaseStatusFlag':
            objectIcon.innerHTML = miscTableHeaderInWorkflow;
            break;
        case 'assignmentIndication':
            objectIcon.innerHTML = headerCompletion;
            break;
        case 'missingInSource':
        case 'changeIndication':
            objectIcon.innerHTML = headerMismatch;
            break;
        case 'externalFlowIndication':
            objectIcon.innerHTML = miscTableHeaderHasExternalDependencies;
            break;
        default:
            break;
    }
    headerContent.appendChild( objectIcon );
    containerElement.appendChild( headerContent );
}

let exports;
export default exports = {
    setIconCellElement,
    addClickHandlerToElement,
    removeIconCellElement,
    columnHeaderIndicationRenderer
};
