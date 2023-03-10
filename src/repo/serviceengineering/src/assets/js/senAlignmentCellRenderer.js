// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/senAlignmentCellRenderer
 */

import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';

let exports = {};
'use strict';

/**
 * Creates the Icon container element for tree command cell.
 *
 * @param {Object} contextObject the vmo and other info of  the cell
 * @param {String} viewName icon view name viewName
 * @param {String} iconName iconName
 * @param {DOMElement} parentElement containerElement
 * @param {String} propName internal name of column
 * @param {String} tooltipViewName name of view file
 * @param {String} tooltipOptions This attribute is used to configure placement and flipBehavior for extended Tooltip
 * @param {Function} callbackApi callback function
 *
 * @returns {DOMElement} icon element that suport dynamic toltip
 */
export const getIconCellElement = function( contextObject,viewName, iconName, parentElement, propName, tooltipViewName, tooltipOptions,callbackApi) {
    if( viewName !== null && iconName !== null ) {
        let props = {
            iconName: iconName,
            tooltipViewName:tooltipViewName,
            propName: propName,
            tooltipOptions: tooltipOptions || { placement : 'right' },
            contextObject:contextObject
        };
        let iconComponent = includeComponent( viewName, props );

        let api = function() {
            if ( callbackApi ) {
                parentElement.classList.add( 'aw-sen-clickableCellIcon' );
                setTimeout( function() {
                    parentElement.onclick = function( event ) {
                        event.preventDefault();
                        event.stopPropagation();
                        callbackApi( event );
                    };
                }, 200 );
            }
        };
        if ( parentElement ) {
            renderComponent( iconComponent, parentElement, api );
        }
    }
    return null;
};


export default {
    getIconCellElement
};
