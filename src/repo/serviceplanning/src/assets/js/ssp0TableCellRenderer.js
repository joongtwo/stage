// Copyright (c) 2022 Siemens

/**
 * @module js/ssp0TableCellRenderer
 */
import eventBus from 'js/eventBus';
import ssp0BackingObjectProviderService from 'js/ssp0BackingObjectProviderService';
import htmlUtil from 'js/htmlUtils';
import tableSvc from 'js/published/splmTablePublishedService';

let exports = {};

/**
 * Create the icon in the cell element
 *
 * @param {String} iconURL - path of image
 * @param {DOMElement} containerElement - the container element
 * @param {Boolean} iconClass class of Icon
 * @return {Object} Cell Image Element
 */
export function setIconCellElement( iconURL, containerElement, iconClass ) {
    let cellImgElement = containerElement.getElementsByTagName( 'img' );
    if ( cellImgElement.length === 0 ) {
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
 * @param {DOMElement} element - the container element
 * @param {String} visibilityState - visibility State of vmo
 */
export function addClickHandlerToElement( vmo, eventName, element, visibilityState ) {
    if ( element ) {
        let tempVisibilityState = visibilityState === 'NONE';
        element.addEventListener( 'click', function( event ) {
            event.stopImmediatePropagation();
            let modelBOM = '';
            if ( eventName === 'partsVisGraphicsVisibilityChanged' || eventName === 'spPartsVisGraphicsVisibilityChanged' ) {
                modelBOM = vmo.uid;
            } else {
                let modelBOMUid = ssp0BackingObjectProviderService.getBomLines( [ vmo ] );
                modelBOM = modelBOMUid[0].uid;
            }
            const eventData = {
                modelId: modelBOM,
                visibilityState: tempVisibilityState,
                vmo: vmo
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
    if ( containerElement.length > 0 ) {
        containerElement.removeChild( cellImgElement[0] );
    }
}

/**
 * Calls methods to get PLF property value as cell text element.
 * @param {Object} refObj the vmo for the cell
 * @param {DOMElement} parentElement parentElement
 * @return {Object} Text Element
 */
export const getTextCellElement = function( refObj, parentElement ) {
    let attributeValue = refObj.plfValue;

    if ( parentElement ) {
        let textElement = document.createElement( 'div' );
        textElement.className = 'aw-splm-tableCellText';
        textElement.innerHTML = attributeValue;
        return textElement;
    }
    return null;
};
export default exports = {
    getTextCellElement,
    setIconCellElement,
    addClickHandlerToElement,
    removeIconCellElement
};
