//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/* global */

/**
 * @module js/mfeGalleryUtils
 */

 'use strict';
 import eventBus from 'js/eventBus';
 
 /**
 * Scroll Left And Right Button for mfeGalleryView
 */
 function scrollLeft() {
     var galleryPanel = document.getElementById( 'mfeGalleryPanel' );
     galleryPanel.scrollLeft -= 600;
     updateVisibilityOfLeftAndRight();
 }
 
 /**
  * Scroll right
  */
 function scrollRight() {
     var galleryPanel = document.getElementById( 'mfeGalleryPanel' );
     galleryPanel.scrollLeft += 600;
     updateVisibilityOfLeftAndRight();
 }
 
 /**
  * updateVisibilityOfLeftAndRight
  */
 function updateVisibilityOfLeftAndRight() {
     setTimeout( function() {
         eventBus.publish( 'mfeGalleryScrollEvent' );
     }, 600 );
 }
 
 /**
  * getThumbnailContainerLeftHiddenWidth
  * @returns {int} scroll left
  */
 function getThumbnailContainerLeftHiddenWidth() {
     var galleryPanel = document.getElementById( 'mfeGalleryPanel' );
     if ( !galleryPanel  ) { return false; }
     return  galleryPanel.scrollLeft;
 }
 
 /**
  * getThumbnailContainerRightHiddenWidth
  * @returns {int} scroll right
  */
 function getThumbnailContainerRightHiddenWidth() {
     var galleryPanel = document.getElementById( 'mfeGalleryPanel' );
     var rightButton = document.getElementById( 'mfeGalleryRightButton' );
     if ( !galleryPanel || !rightButton ) { return false; }
 
     return galleryPanel.scrollWidth - galleryPanel.scrollLeft -
         galleryPanel.offsetWidth - rightButton.offsetWidth;
 }
 /**
  * Scroll right
  * @returns {bool} isGalleryRightButtonEnabled
  */
function getVisibilityOfLeftAndRight() {
    return {
        isGalleryLeftButtonEnabled: getThumbnailContainerLeftHiddenWidth() > 0,
        isGalleryRightButtonEnabled: getThumbnailContainerRightHiddenWidth() > 0
    };
}
 
 const exports = {
     scrollLeft,
     scrollRight,
     getVisibilityOfLeftAndRight
 };
 
 export default exports;
 