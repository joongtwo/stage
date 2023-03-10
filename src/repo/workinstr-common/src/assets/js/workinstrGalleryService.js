// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/workinstrGalleryService
 */

/**
 * Set the gallery data to be available in the gallery context
 *
 * Please use following object names in the galleryContext for consistency:
 * selectedItem - the selected item to display in the viewer
 *
 * @param {object} galleryModel - the object where the current gallery context is saved
 * @param {object} galleryContext - anything you want to be set as the gallery context
 */
export function setGalleryContext( galleryModel, galleryContext ) {
    if( galleryModel && galleryContext && typeof galleryContext === 'object' ) {
        galleryModel.update( { ...galleryModel.getValue(), ...galleryContext } );
    }
}


let exports;
export default exports = {
    setGalleryContext
};
