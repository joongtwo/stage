// Copyright (c) 2022 Siemens

/**
 * Service for In a workflow table column renderer
 *
 * @module js/epReleaseStatusFlagTablePropertyRenderer
 */
import { getBaseUrlPath } from 'app';
import epTableCellRenderer from 'js/epTableCellRenderer';

/**
 * This will render Release Status Flag on released object into 'In a workflow' table column.
 * @param { ViewModelObject } vmo - a given viewModelObject
 * @param { DOM } containerElement - the DOM element which will contain what is eventually rendered
 */
export function rendererReleaseStatusFlagVisibility( vmo, containerElement ) {
    if( !containerElement ) {
        return;
    }

    let isObjectReleased = false;
    if( vmo.props.bl_rev_last_release_status ) {
        const releaseStatus = vmo.props.bl_rev_last_release_status.dbValue;
        if( releaseStatus && releaseStatus !== null && releaseStatus !== '' ) {
            isObjectReleased = true;
        }
    }

    rendererReleaseStatusFlag( containerElement, isObjectReleased );
}

/**
 * This will render Release Status Flag on released object
 * @param { DOM } containerElement - the DOM element
 * @param { Boolean } isObjectReleased - if given object is released
 */
function rendererReleaseStatusFlag( containerElement, isObjectReleased ) {
    const iconSource = isObjectReleased ? getIconSource() : '';
    const iconClass = isObjectReleased ? 'aw-ep-tableCellindicator' : 'aw-ep-AssignmentIndicationHiddenCellIcon';
    if( iconSource ) {
        epTableCellRenderer.setIconCellElement( iconSource, containerElement, iconClass );
    }
}

/**
 * Renderer for releaseStatusFlagH column header
 *
 * @param {DOMElement} containerElement - the icon container element
 * @param {String} columnField - column field name
 * @param {Object} tooltip - tooltip object
 * @param {Object} column - column object
 */
export function releaseStatusFlagHeaderRenderer( containerElement, columnField, tooltip, column ) {
    epTableCellRenderer.columnHeaderIndicationRenderer( containerElement, columnField, column );
}

/**
 * Gets icon image source
 *
 * @return {String} image source
 */
function getIconSource() {
    let cellImg = getBaseUrlPath();
    return cellImg += '/image/indicatorReleased16.svg';
}

let exports;
export default exports = {
    rendererReleaseStatusFlagVisibility,
    releaseStatusFlagHeaderRenderer
};
