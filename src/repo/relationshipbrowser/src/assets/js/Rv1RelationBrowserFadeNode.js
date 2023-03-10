// Copyright (c) 2022 Siemens

/**
 * This module defines Rv1RelationBrowserFadeNode
 *
 * @module js/Rv1RelationBrowserFadeNode
 */
import rbUtils from 'js/Rv1RelationBrowserUtils';

var exports = {};

/**
 * Funciton which handles the details of updating the element's opacity based on progress.
 *
 * @param {Element} element to update.
 * @param {Float} lowerOpacity the lower end of the opacity space.
 * @param {Float} upperOpacity the upper end of the opacity space.
 * @param {Float} progress the animation progress, a time fraction between 0 and 1.
 */
var updateOpacity = function( element, lowerOpacity, upperOpacity, progress ) {
    var newOpacity = lowerOpacity +  ( upperOpacity - lowerOpacity ) * progress;
    newOpacity = Math.max( 0, newOpacity );
    newOpacity = Math.min( 1, newOpacity );
    element.style.opacity = newOpacity;
};

/**
 *
 * @param {Object} node to animate.
 * @param {Object} duration duration.
 * @param {function} finishCallback the callback to execute when the action completes.
 */
var startFadeNodeAnimation = function( node, duration, finishCallback ) {
    var cancelled = false;
    var start = performance.now();
    var element = node.getSVGDom();
    var originalOpacity = element.style.opacity ? parseFloat( element.style.opacity ) : 1;

    // Set up a method to cancel the fade.
    node.cancelFadeAnimation = function() {
        if( !cancelled ) {
            cancelled = true;

            // Reset the animation clock.
            start = performance.now();
        }
    };

    // Requests an animation frame and tracks it in the fadeAnimationId.
    node.fadeAnimationId = window.requestAnimationFrame( function animate( time ) {
        // The "fraction" of the time elapsed since the start
        // of the animation.
        var timeFraction = ( time - start ) / duration;
        timeFraction = Math.max( 0, timeFraction );
        timeFraction = Math.min( 1, timeFraction );

        if( cancelled ) {
            // Fade in (increasing timefraction) from the current until at the original opacity.
            // Since we use the current opacity at each animation's frame, the resulting fade-in
            // is more "snappy" as it returns to the original opacity more exponentially, unlike
            // the linear fade-out.
            updateOpacity( element, parseFloat( element.style.opacity ), originalOpacity, timeFraction );
        } else {
            // Fade out (decreasing timefraction) from the original opacity until at 0 opacity.
            updateOpacity( element, 0, originalOpacity,  1 - timeFraction  );
        }

        // Still more work to do.
        if( timeFraction < 1 ) {
            // Request another animation frame.
            node.fadeAnimationId = window.requestAnimationFrame( animate );
        } else {
            // Cancel the outstanding animation request.
            window.cancelAnimationFrame( node.fadeAnimationId );

            // Execute the callback.
            if( finishCallback ) {
                finishCallback( cancelled );
            }

            // Clean up.
            delete node.fadeAnimationId;
            delete node.cancelFadeAnimation;
        }
    } );
};

/**
 * Start/Stop the fade animation for selected node.
 *
 * @param {Object} graphModel the graph model object.
 * @param {Object} node the node selected.
 * @returns {Object} action state
 */
export let fadeNodeAnimation = function( graphModel, node ) {
    // Don't allow removal of the root.
    if( !node || node.isRoot() ) {
        return;
    }

    // Check if the node is already fading
    if( node.fadeAnimationId && node.cancelFadeAnimation ) {
        // If so, cancel the animation (fade back in).
        node.cancelFadeAnimation();
    } else {
        // Otherwise, start a new animation.
        startFadeNodeAnimation( node, 1500, function finishCallback( bWasCancelled ) {
            if( !bWasCancelled ) {
                //remove all related items
                graphModel.graphControl.graph.removeNodes( [ node ] );
                rbUtils.resolveConnectedGraph( graphModel );
            }
        } );
    }

    return {}; // return empty object to reset actionState
};

export default exports = {
    fadeNodeAnimation
};
