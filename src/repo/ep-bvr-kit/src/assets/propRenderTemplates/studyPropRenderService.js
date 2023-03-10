// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/* global */

/**
 * @module propRenderTemplates/studyPropRenderService
 *
 */
import { renderComponent } from 'js/declReactUtils';
import { includeComponent } from 'js/moduleLoader';
import appCtxService from 'js/appCtxService';
import i18n from 'i18n/StudyMessages';
import { svgString as miscTableHeaderLocked16 } from 'image/miscTableHeaderLocked16.svg';

const TABLE_CELL_IMAGE_VIEW = 'MfeTableCellImage';
const TOOLTIP_VIEW = 'MfeGenericTooltip';
const TABLE_CELL_IMAGE_TOOLTIP_CLASS = 'aw-epGraphics-tableCellImageTooltip';

/**
 * Generates Is Modifiable property DOM Element
 * @param { Object } vmo - ViewModelObject for which release status is being rendered
 * @param { Object } containerElem - The container DOM Element inside which is modifiable status will be rendered
 */
let renderIsModifiableProperty = function( vmo, containerElem ) {
    let is_modifiable = vmo.props.is_modifiable.dbValue;
    if( !is_modifiable ) {
        let cellImg = document.createElement( 'img' );
        cellImg.className = 'aw-visual-indicator';
        cellImg.title = is_modifiable;
        var imgSrc = 'assets/image/indicatorLocked16.svg';
        cellImg.src = imgSrc;
        containerElem.appendChild( cellImg );
    }
};
/**
 * Generates Is Modifiable Header DOM Element
 *
 * @param { Object } containerElement - The container DOM Element of isModifiable Column
 */
let renderIsModifiableHeader = function( containerElement ) {
    let objectIcon = document.createElement( 'span' );
    objectIcon.className = 'aw-visual-indicator';
    objectIcon.innerHTML = miscTableHeaderLocked16;
    objectIcon.style.height = '16px';
    objectIcon.style.width = '16px';
    objectIcon.style.paddingRight = '16px';
    containerElement.appendChild( objectIcon );
};
/**
 * Set component data
 *
 * @param {String} iconId -
 * @param {*} containerElement -
 */
function setComponentData( iconId, containerElement ) {
    if( iconId ) {
        const tooltipData = {
            extendedTooltip: {
                title: i18n.BriefcaseExportColumnName,
                className:  TABLE_CELL_IMAGE_TOOLTIP_CLASS
            }
        };
        const props = {
            imageSrc: iconId,
            isClickable: false,
            tooltipView: TOOLTIP_VIEW,
            tooltipData
        };
        const imageElement = includeComponent(  TABLE_CELL_IMAGE_VIEW, props );
        renderComponent( imageElement, containerElement );
    }
}

/**
   * Render the approved briefcase export for property using release_status_list property.
   *
   * @param {Object} vmo - the vmo for the cell
   * @param {DOMElement} containerElement - the container element
   */
function rendererApprovedForBriefcaseExport( vmo, containerElement ) {
    if( !containerElement || !vmo.uid ) {
        return;
    }
    let release_status_list = vmo.props.release_status_list.displayValues;
    let allPreference = appCtxService.getCtx( 'preferences' );
    let preference_values = allPreference.MEStudyMaturityStatusforBriefcaseExport;

    let result = release_status_list.some( release_status => preference_values.includes( release_status ) );
    if( result === true ) {
        const iconId = 'indicatorBriefcase16';
        setComponentData( iconId, containerElement );
    }
}

export default {
    renderIsModifiableProperty,
    renderIsModifiableHeader,
    setComponentData,
    rendererApprovedForBriefcaseExport
};
