// Copyright (c) 2022 Siemens

/**
 * @module js/epValidationCellRenderer
 */
import { getBaseUrlPath } from 'app';

const EP_VALIDATION_PASS_INDICATOR = 'indicatorInformationSuccess16.svg';
const EP_VALIDATION_FAIL_INDICATOR = 'indicatorError16.svg';
const EP_VALIDATION_NA_INDICATOR = 'indicatorNotRelevant16.svg';
const PASS = 'Pass';
const FAIL = 'Fail';

/**
 * Get status indicator for input vmo
 *
 * @param {Object} vmo - vmo to determine status for
 * @param {String} columnName - column to determine status for
 * @returns {string} - Status indicator string
 */
const getStatusIndicator = function( vmo, columnName ) {
    let statusIndicatorObject = EP_VALIDATION_NA_INDICATOR;

    if( vmo.props[ columnName ].uiValue === PASS ) {
        statusIndicatorObject = EP_VALIDATION_PASS_INDICATOR;
    } else if( vmo.props[ columnName ].uiValue === FAIL ) {
        statusIndicatorObject = EP_VALIDATION_FAIL_INDICATOR;
    } else {
        statusIndicatorObject = EP_VALIDATION_NA_INDICATOR;
    }

    return statusIndicatorObject;
};

/**
 * Gets icon image source path
 *
 * @param {Object} indicatorFile Indicator file name
 * @return {String} image source
 */

const getIconSourcePath = function( indicatorFile ) {
    return getBaseUrlPath() + '/image/' + indicatorFile;
};

/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @returns {Object} the modified container element
 */
export function validationStatusRenderer( vmo, containerElement, columnName ) {
    // remove the cell text
    if( containerElement.childNodes[ 0 ] ) {
        containerElement.removeChild( containerElement.childNodes[ 0 ] );
    }
    containerElement.setAttribute( 'class', 'aw-epValidation-tableCell' );
    const status = getStatusIndicator( vmo, columnName );
    const iconSource = getIconSourcePath( status );
    let cellImg = document.createElement( 'img' );
    cellImg.title = columnName;
    cellImg.src = iconSource;
    containerElement.appendChild( cellImg );
    return containerElement;
}

export default {
    validationStatusRenderer
};
