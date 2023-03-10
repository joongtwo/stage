// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import $ from 'jquery';
/**
 * @module js/utils/mfeListUtils
 */


/**
 * @param {modelObject} listElementClassName - class name of list

*/
export function verticalListScrollToSelected( listElementClassName ) {
    let elementList = document.querySelectorAll( listElementClassName );
    elementList.forEach( ( ele ) => {
        if (
            $.inArray(
                listElementClassName.replace( '.', '' ),
                ele.classList
            ) !== -1
        ) {
            ele.scrollIntoView();
        }
    } );
}
/**
 * @param {String} panelId - div id of visuals gallery panel
*/

export function horizontalListScrollToEnd( panelId ) {
    let id = document.getElementById( panelId );
    id.scrollLeft += 50000000000;
}

export default {
    verticalListScrollToSelected,
    horizontalListScrollToEnd
};
