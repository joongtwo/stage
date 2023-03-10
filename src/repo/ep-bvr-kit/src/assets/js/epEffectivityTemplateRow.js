// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 *
 * @module js/epEffectivityTemplateRow
 */

import localeService from 'js/localeService';



let exports = {};

const svgns = 'http://www.w3.org/2000/svg';
const DIV_ELEMENT = 'div';
const SPAN_ELEMENT = 'span';

const EFFECTIVITY_UNIT_UP = 'UP';

export let createEffectivityRowTemplate = function( rowObject, graphCanvas, rowNameElement, configData ) {
    let rowObjectName;
    if( !rowObject ) {
        rowObjectName = null;
    } else{
        let objectName = rowObject.props ? rowObject.props[configData.rowObjectNameProp].dbValues[0] : rowObject.name;
        let objectParentName;
        if( rowObject.props  && rowObject.props.awb0Parent && configData.isShowParentName ) {
            objectParentName = rowObject.props.awb0Parent.uiValues[0];
            let title = '';
            const localTextBundle = localeService.getLoadedText( 'InstructionsEffectivityMessages' );
            title = title.concat( localTextBundle.effectivityRowTitle.replace( '{0}', objectName ) );
            title = title.replace( '{1}', objectParentName );

            rowObjectName = title;
        } else{
            rowObjectName = objectName;
        }
    }
    let rowElement = document.createElement( DIV_ELEMENT );
    rowElement.setAttribute( 'id', rowObjectName );
    rowElement.setAttribute( 'style', 'height: 78px;' );
    let rowName = document.createElement( DIV_ELEMENT );

    rowName.setAttribute( 'class', 'aw-epInstructionsEffectivity-rowNameElement' );

    let nameSpan = document.createElement( SPAN_ELEMENT );
    nameSpan.setAttribute( 'title', rowObjectName );
    nameSpan.innerHTML = rowObjectName;
    rowName.appendChild( nameSpan );
    if( !rowName ) {
        return;
    }
    if( rowElement !== null ) {
        rowNameElement.appendChild( rowName );

        let rowContainer = document.createElement( DIV_ELEMENT );
        if( !rowContainer ) {
            return;
        }
        rowContainer.setAttribute( 'class', 'aw-epValidateEffectivity-wiEffectivityRowContainer' );
        if( rowObject && rowObject.uid ) {
            rowContainer.setAttribute( 'id', rowObject.uid );
        }

        let rowSvg = document.createElementNS( svgns, 'svg' );
        rowSvg.setAttributeNS( null, 'class', 'aw-epValidateEffectivity-wiEffectivityObjectRow' );
        rowSvg.setAttributeNS( null, 'width', 0 );
        rowSvg.setAttributeNS( null, 'height', 0 );

        rowContainer.appendChild( rowSvg );

        rowElement.appendChild( rowContainer );
        graphCanvas.appendChild( rowElement );
        return {
            container: rowContainer,
            svg: rowSvg
        };
    }
};

export let createAndAddRect = function( rowSvg, rowID, unit, checked, rectClass, mouseover, mouseout, onclick ) {
    let rect = document.createElementNS( svgns, 'rect' );
    let length = 20;
    let width = rowSvg.width.baseVal.value;
    rowSvg.width.baseVal.value = width + length;
    rowSvg.height.baseVal.value = length;
    rect.setAttributeNS( null, 'id', rowID + '-' + unit );
    rect.setAttributeNS( null, 'unit', unit );
    rect.setAttributeNS( null, 'checked', checked );
    rect.setAttributeNS( null, 'uid', rowID );
    rect.setAttributeNS( null, 'x', width );
    rect.setAttributeNS( null, 'height', length );
    rect.setAttributeNS( null, 'width', length );
    rect.setAttributeNS( null, 'class', rectClass );

    rect.addEventListener( 'mouseover', mouseover );
    rect.addEventListener( 'mouseout', mouseout );
    rect.onclick = onclick;

    rowSvg.appendChild( rect );
};

export let createAndAddUpCheckbox = function( rowSvg, rowID, unit, isUP, onclick ) {
    let upCheckbox = document.createElement( DIV_ELEMENT );
    upCheckbox.setAttribute( 'class', 'aw-epInstructionsEffectivity-upCheckboxDefault' );
    let parentdiv = document.createElement( DIV_ELEMENT );
    upCheckbox.setAttribute( 'id', rowID + '-' + unit );
    parentdiv.setAttribute( 'style', 'padding: 30px 0 0 16px; height: 78px;' );
    parentdiv.append( upCheckbox );

    upCheckbox.setAttribute( 'isUP', isUP );
    if( !onclick ) {
        upCheckbox.innerHTML = EFFECTIVITY_UNIT_UP;
    } else {
        upCheckbox.onclick = onclick;
    }
    if( isUP ) {
        upCheckbox.setAttribute( 'class', 'aw-epInstructionsEffectivity-upCheckboxSet' );
        upCheckbox.innerHTML = EFFECTIVITY_UNIT_UP;
    }
    rowSvg.appendChild( parentdiv );
};

export default exports = {
    createEffectivityRowTemplate,
    createAndAddRect,
    createAndAddUpCheckbox
};
