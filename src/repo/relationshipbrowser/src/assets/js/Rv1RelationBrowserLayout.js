// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */
/**
 * This module defines layout related functions
 *
 * @module js/Rv1RelationBrowserLayout
 */
import _ from 'lodash';
import graphConstants from 'js/graphConstants';

'use strict';

var exports = {};

export let incUpdateActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

export let sortedLayoutActive = function( layout ) {
    return layout && layout.type === 'SortedLayout' && layout.isActive();
};

var removeObjectsFromSortedLayout = function( layout, graphItems ) {
    if( !layout || !graphItems || !exports.sortedLayoutActive( layout ) ) {
        return;
    }

    _.each( graphItems.nodes, function( item ) {
        if( layout.containsNode( item ) ) {
            // only remove nodes, related edges, ports will be removed automatically
            layout.removeNode( item );
        }
    } );
};

export let resetLayoutData = function( layout ) {
    if( !layout.data ) {
        layout.data = {};
    }

    if( layout.type === graphConstants.DFLayoutTypes.SortedLayout ) {
        layout.data.itemsToBeRemoved = {
            nodes: [],
            edges: []
        };
        layout.data.itemsToBeFilterOff = {
            nodes: [],
            edges: []
        };
        layout.data.itemsToBeFilterOn = {
            nodes: [],
            edges: []
        };
    }
};

var concatMerge = function( destObj, sourceObj ) {
    if( !sourceObj ) {
        return;
    }

    //handle aray case
    if( _.isArray( destObj ) ) {
        _.each( sourceObj, function( item ) {
            if( destObj.indexOf( item ) < 0 ) {
                destObj.push( item );
            }
        } );
    } else {
        //handle object case
        _.mergeWith( destObj, sourceObj, function customizer( objValue, srcValue ) {
            if( _.isArray( objValue ) ) {
                _.each( srcValue, function( item ) {
                    if( objValue.indexOf( item ) < 0 ) {
                        objValue.push( item );
                    }
                } );
                return objValue;
            }
        } );
    }
};

var updateToSortedLayout = function( layout, eventType, eventData ) {
    if( !layout || !eventType || !eventData ) {
        return;
    }

    if( eventType === 'itemsRemoved' ) {
        concatMerge( layout.data.itemsToBeRemoved, eventData );
    } else if( eventType === 'visibilityChanged' ) {
        var visible = eventData.visible;
        var destData = visible ? layout.data.itemsToBeFilterOff : layout.data.itemsToBeFilterOn;
        concatMerge( destData, eventData );
    }
};

export let updateToLayout = function( layout, eventType, eventData ) {
    if( !layout || !eventType || !eventData ) {
        return;
    }

    if( !layout.data ) {
        exports.resetLayoutData( layout );
    }

    if( exports.sortedLayoutActive( layout ) ) {
        updateToSortedLayout( layout, eventType, eventData );
    }
};

var checkNeedToUpdate = function( objects ) {
    var result = _.find( [].concat( objects ), function( obj ) {
        if( _.isArray( obj ) ) {
            return obj.length > 0;
        }

        var validObj = null;
        _.each( obj, function( value, key ) {
            if( _.isArray( value ) && value.length > 0 ) {
                // break loop
                validObj = obj;
                return false;
            }
        } );

        if( validObj ) {
            return true;
        }
    } );

    return result !== undefined;
};

var applySortedLayoutUpdate = function( layout ) {
    if( !layout || !layout.data ) {
        return;
    }

    var check = [].concat( [ layout.data.itemsToBeRemoved, layout.data.itemsToBeFilterOn, layout.data.itemsToBeFilterOff ] );
    if( !checkNeedToUpdate( check ) ) {
        return;
    }

    layout.applyUpdate( function() {
        removeObjectsFromSortedLayout( layout, layout.data.itemsToBeRemoved );

        // Remove duplicates between filter On/Off objects

        var itemsToBeFilterOn = _.assign( {}, layout.data.itemsToBeFilterOn );
        itemsToBeFilterOn.nodes = _.difference( layout.data.itemsToBeFilterOn.nodes, layout.data.itemsToBeFilterOff.nodes );
        itemsToBeFilterOn.edges = _.difference( layout.data.itemsToBeFilterOn.edges, layout.data.itemsToBeFilterOff.edges );

        // turn filter on for objects
        if( itemsToBeFilterOn.nodes.length > 0 || itemsToBeFilterOn.edges.length > 0 ) {
            layout.filterOn( itemsToBeFilterOn.nodes, itemsToBeFilterOn.edges );
        }

        var itemsToBeFilterOff = {};
        itemsToBeFilterOff.nodes = [];
        itemsToBeFilterOff.edges = [];

        // only add objects that are not already in layout

        for( var x1 = 0; x1 < layout.data.itemsToBeFilterOff.nodes.length; ++x1 ) {
            var node = layout.data.itemsToBeFilterOff.nodes[ x1 ];

            if( !layout.containsNode( node ) ) {
                itemsToBeFilterOff.nodes.push( node );
            }
        }

        for( var x2 = 0; x2 < layout.data.itemsToBeFilterOff.edges.length; ++x2 ) {
            var edge = layout.data.itemsToBeFilterOff.edges[ x2 ];

            if( !layout.containsEdge( edge ) ) {
                var sourceNode = edge.getSourceNode();
                var targetNode = edge.getTargetNode();

                if( ( layout.containsNode( sourceNode ) || itemsToBeFilterOff.nodes.indexOf( sourceNode ) >= 0 ) &&
                    ( layout.containsNode( targetNode ) || itemsToBeFilterOff.nodes.indexOf( targetNode ) >= 0 ) ) {
                    itemsToBeFilterOff.edges.push( edge );
                }
            }
        }

        // turn filter off for objects
        if( itemsToBeFilterOff.nodes.length > 0 || itemsToBeFilterOff.edges.length > 0 ) {
            layout.filterOff( itemsToBeFilterOff.nodes, itemsToBeFilterOff.edges );
        }
    } );
};

/**
 * apply bunch layout update when graph has changes
 *
 * @param {graphControl} graphControl the graphControl instance
 */
export let applyLayoutUpdate = function( graphControl ) {
    var layout = graphControl.layout;
    if( !layout ) {
        return;
    }
    if( layout.type === graphConstants.DFLayoutTypes.SortedLayout ) {
        applySortedLayoutUpdate( layout );
    }

    exports.resetLayoutData( layout );
};

export default exports = {
    incUpdateActive,
    sortedLayoutActive,
    resetLayoutData,
    updateToLayout,
    applyLayoutUpdate
};
