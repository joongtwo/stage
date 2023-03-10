//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Rv1ShowObjectRelationsService
 */
import clientDataModel from 'soa/kernel/clientDataModel';
import legendSvc from 'js/Rv1RelationBrowserLegendService';
import _ from 'lodash';
import logger from 'js/logger';

var _rootId = null;

const _propertyDescriptor = {
    valueType: null,
    displayName: null,
    lovs: false,
    anArray: false,
    maxLength: 256
};

/**
 * Set the hidden property on the model object for cell rendering
 * @param {IModelObject} modelObject model object to set the properties on
 * @param {boolean} isHidden whether the model object is hidden on the graph or shown
 */
function _setObjectVisibility( modelObject, isHidden ) {
    if( modelObject.props.halfTone ) {
        modelObject.props.halfTone.dbValue = isHidden;
        modelObject.props.halfTone.dbValues = [ isHidden ];
    } else {
        var _halfToneProp = {
            dbValue: isHidden,
            dbValues: [ isHidden ],
            propertyDescriptor: _propertyDescriptor
        };
        modelObject.props.halfTone = _halfToneProp;
    }
}

/**
 * Set the direction and hidden property on the model object for cell rendering
 * @param {IModelObject} modelObject model object to set the properties on
 * @param {string} direction direction of the connection (incoming/outgoing/both)
 * @param {boolean} isHidden whether the model object is hidden on the graph or shown
 */
function _setModelProp( modelObject, direction, isHidden ) {
    var foundDirection = false;
    _.forEach( modelObject.props.awp0CellProperties.dbValues, function( dbVal ) {
        if( dbVal === direction ) {
            foundDirection = true;
        }
    } );

    if( !foundDirection ) {
        modelObject.props.awp0CellProperties.dbValues.push( direction );
    }
    _setObjectVisibility( modelObject, isHidden );
}

/**
 * Gets the directions for the connected nodes
 * @param {String} rootUid UID of the selected node
 * @param {Edge[]} edges edge information from the SOA
 * @param {String[]} filteredRelations filtered out relations
 * @return {map} map of other end UID v/s direction of connection with the rootUid
 */
function _getNodeDirections( rootUid, edges, filteredRelations ) {
    var nodeDirections = [];
    _.forEach( edges, function( edge ) {
        if( _.includes( filteredRelations, edge.relationType ) ) {
            return;
        }
        var direction = null;
        var otherEndUid = null;
        if( edge.rightId === rootUid ) {
            direction = 'incoming';
            otherEndUid = edge.leftId;
        } else if( edge.leftId === rootUid ) {
            direction = 'outgoing';
            otherEndUid = edge.rightId;
        }
        if( !direction || !otherEndUid ) {
            logger.error( 'Failed to get direction for edge with rightId=\'' +
                edge.rightId + '\' and leftId=\'' + edge.leftId + '\'' );
            return; // this means continue for _.forEach()
        }
        var existing = nodeDirections[ otherEndUid ];

        if( direction === existing ) {
            return;
        } else if( existing ) {
            direction = 'both';
        }

        nodeDirections[ otherEndUid ] = direction;
    } );
    return nodeDirections;
}

/**
 * Sets the filtered types
 * @param {Category[]} categories list of legend categories
 * @return {String[]} types filtered based on legend categories
 */
function _setFilteredTypes( categories ) {
    let filteredTypes = [];
    _.forEach( categories, function( category ) {
        if( category.isFiltered === true ) {
            filteredTypes.push( category.internalName );
        }
    } );
    return filteredTypes;
}

/**
 * Filter the input object list based on filter string
 * @param {Array} list list of objects
 * @param {String} filter filter string
 * @param {Array} legendFilters legend filters
 * @returns {Array} list of filtered objects
 */
function checkFilter( list, filter, legendFilters ) {
    var rData = [];
    for( var i = 0; i < list.length; ++i ) {
        var _isFiltered = legendSvc.isObjectFiltered( list[ i ], legendFilters );
        if( _isFiltered ) {
            continue;
        }
        if( filter !== '' ) {
            // We have a filter, don't add nodes unless the filter matches a cell property
            for( var idx = 0; idx < list[ i ].props.awp0CellProperties.dbValues.length; idx++ ) {
                var property = list[ i ].props.awp0CellProperties.dbValues[ idx ].toLocaleLowerCase().replace(
                    /\\|\s/g, '' );
                if( property.indexOf( filter.toLocaleLowerCase().replace( /\\|\s/g, '' ) ) !== -1 ) {
                    // Filter matches a property, add node to output list and go to next node
                    rData.push( list[ i ] );
                    break;
                }
            }
        } else {
            // No filter, just add the node to output list
            rData.push( list[ i ] );
        }
    }
    return rData;
}

/**
 * Get filtered list based on filter string
 * @param {Object} data data
 * @param {Array} incoming incoming related objects
 * @param {Array} outgoing outgoing related objects
 * @param {Array} both incoming and outgoing related objects
 * @param {Array} legendFilters legend filters
 * @param {String} listOrderPref RV1_DARB_Hide_Unhide_List_Order_Incoming_First preference value
 * @returns {Array} list of filtered objects
 */
export let functionHiddenNodeList = function( data, incoming, outgoing, both, legendFilters, listOrderPref ) {
    var rData = [];

    if( incoming && outgoing && both ) {
        const incomingFirst = listOrderPref === 'true';

        var filter = '';
        if( 'filterBox' in data && 'dbValue' in data.filterBox ) {
            filter = data.filterBox.dbValue;
        }

        if( incomingFirst ) {
            rData = checkFilter( incoming, filter, legendFilters );
            rData = rData.concat( checkFilter( both, filter, legendFilters ) );
            rData = rData.concat( checkFilter( outgoing, filter, legendFilters ) );
        } else {
            rData = checkFilter( outgoing, filter, legendFilters );
            rData = rData.concat( checkFilter( both, filter, legendFilters ) );
            rData = rData.concat( checkFilter( incoming, filter, legendFilters ) );
        }
    }

    return rData;
};

/**
 * This will identify which types or relations are hidden
 * @param {Object} legendState Legend State (i.e. ctx.graph.legendState)
 * @return {Object} Filter Info
 */
export let setFilterInfo = function( legendState ) {
    let filteredTypes;
    let filteredRelations;
    _.forEach( legendState.activeView.categoryTypes, function( categoryType ) {
        if( categoryType.internalName === 'objects' ) {
            filteredTypes = _setFilteredTypes( categoryType.categories );
        } else if( categoryType.internalName === 'relations' ) {
            filteredRelations = _setFilteredTypes( categoryType.categories );
        }
    } );

    return {
        filteredTypes: filteredTypes,
        filteredRelations: filteredRelations
    };
};

/**
 * Hides or unhides nodes in the graph
 * @param {Object} data data
 * @param {Object} selectedObject Selected Object
 * @param {Object} graphActionState Graph Action State
 */
export let functionHideUnhideNodes = function( data, selectedObject, graphActionState ) {
    if( selectedObject ) {
        const { nodeModelMap, nodeEdgesMap, allDirections, graphData } = data;

        var isHidden = selectedObject.props.halfTone.dbValue;
        let direction = allDirections[ selectedObject.uid ];

        let expandDirection = direction;
        if( direction === 'incoming' ) {
            expandDirection = 'backward';
        } else if( direction === 'outgoing' ) {
            expandDirection = 'forward';
        } else if( direction === 'both' ) {
            expandDirection = 'all';
        }

        let graphActionStateValue;
        if( !isHidden ) {
            // hide the node
            graphActionStateValue = {
                removeObjectsFromGraph: {
                    nodes: [ selectedObject ]
                }
            };
        } else {
            // show the node and edge
            const addedNode = nodeModelMap[ selectedObject.uid ];
            const addedEdges = nodeEdgesMap[ addedNode.id ].slice( 0 );

            graphData.nodes = [ addedNode ];
            graphData.edges = addedEdges;

            graphActionStateValue = {
                drawGraph: {
                    graphData: graphData,
                    expandGraphData: {
                        expandDirection: expandDirection
                    }
                }
            };
        }
        graphActionState.update( graphActionStateValue );
    }
};

/**
 * when app detects node addition/removal event, should update the Model Object opacity in the relations panel.
 * @param {Object} eventData Items added to graph
 * @param {Array} listedNodes nodes listed on the panel
 * @param {Boolean} isHidden specify if the object is hidden on graph now
 * @returns {Object} Action State
 */
export let graphVisibilityChanged = function( eventData, listedNodes, isHidden ) {
    let actionStateValue = {};
    try {
        if( !eventData ) {
            return;
        }
        let changedCount = 0;
        _.forEach( eventData.nodes, function( graphNode ) {
            _.forEach( listedNodes, function( modelObject ) {
                if( modelObject.uid !== graphNode.model.nodeObject.uid ) {
                    return;
                }
                _setObjectVisibility( modelObject, isHidden );
                ++changedCount;
            } );
        } );
        if( changedCount > 0 ) {
            actionStateValue = {
                callObjRelationsDataProvider: {}
            };
        }
    } catch ( ex ) {
        logger.error( ex );
    }

    return actionStateValue;
};

/**
 * Parses the response from the queryNetwork2 SOA
 * @param {Object} data View Model data
 * @param {Object} graphModel graph model
 * @return {Object} nodes categorized as incoming, outgoing, both
 */
export let parseRelatedObjects = function( data, graphModel ) {
    let { filterInfo, graphData } = data;
    let parsedNodes = {
        incoming: [],
        outgoing: [],
        both: []
    };
    _rootId = null;
    const nodeModelMap = {};
    const nodeEdgesMap = {};

    if( !graphData ) {
        graphData = graphModel.graphData;
    }
    const allDirections = _getNodeDirections( graphData.rootIds[ 0 ],
        graphData.edges, filterInfo.filteredRelations );

    _.forEach( graphData.nodes, function( nodeData ) {
        if( _.includes( graphData.rootIds, nodeData.metaObject.uid ) ) {
            if( _rootId === null ) {
                _rootId = nodeData.metaObject.uid;
            }
            return;
        }

        if( nodeData.metaObject.uid === _rootId ) {
            return;
        }

        if( _.includes( filterInfo.filteredTypes, nodeData.props.Group ) ) {
            logger.debug( 'Filtering out ' + nodeData.metaObject.uid + ' based on object type' );
            return;
        }

        var modelObject = clientDataModel.getObject( nodeData.metaObject.uid );

        var graphNodeModel = graphModel.dataModel.nodeModels[ modelObject.uid ];
        var isHidden = false;

        if( !graphNodeModel ) {
            isHidden = true;
        }

        var direction = allDirections[ modelObject.uid ];

        if( !direction || direction.length === 0 ) {
            logger.debug( 'Failed to get direction for ' + modelObject.uid );
            return;
        }

        if( direction === 'incoming' ) {
            parsedNodes.incoming.push( modelObject );
        } else if( direction === 'outgoing' ) {
            parsedNodes.outgoing.push( modelObject );
        } else {
            parsedNodes.both.push( modelObject );
        }

        for( var i = 0; i < graphData.edges.length; i++ ) {
            if( modelObject.uid === graphData.edges[ i ].rightId || modelObject.uid === graphData.edges[ i ].leftId ) {
                var edges = [];
                if( nodeEdgesMap[ nodeData.id ] !== undefined ) {
                    edges = nodeEdgesMap[ nodeData.id ].slice( 0 );
                    edges.push( graphData.edges[ i ] );
                    delete nodeEdgesMap[ nodeData.id ];
                } else {
                    edges.push( graphData.edges[ i ] );
                }
                nodeEdgesMap[ nodeData.id ] = edges;
            }
        }
        nodeModelMap[ modelObject.uid ] = nodeData;

        _setModelProp( modelObject, data.i18n.direction + '\\:' + data.i18n[ direction ], isHidden );
    } ); // end _.forEach

    return {
        parsedNodes: parsedNodes,
        nodeModelMap: nodeModelMap,
        nodeEdgesMap: nodeEdgesMap,
        allDirections: allDirections
    };
};

/**
 * Rv1ShowObjectRelationsService factory
 */
let exports = {
    functionHiddenNodeList,
    setFilterInfo,
    functionHideUnhideNodes,
    graphVisibilityChanged,
    parseRelatedObjects
};

export default exports;
