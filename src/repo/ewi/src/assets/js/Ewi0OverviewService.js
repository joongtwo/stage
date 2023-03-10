// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/Ewi0OverviewService
 */
import appCtxSvc from 'js/appCtxService';
import ewiService from 'js/ewiService';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import workinstrGraphService from 'js/workinstrGraphService';
import iconService from 'js/iconService';
import workinstrFileTicketService from 'js/workinstrFileTicketService';
import workinstrTableSvc from 'js/workinstrTableService';
import _ from 'lodash';
import graphConstants from 'js/graphConstants';


let m_travelerList;
let m_listOfHierarchyEdges;
let m_listOfSequentialEdges;
let m_graphModel;


export const getOverviewPolicy = function() {
    let policy = [];

    const additionalProps = {
        name: 'Mfg0sub_elements',
        modifiers: [ {
            name: 'withProperties',
            Value: 'true'
        } ]
    };
    const props = appCtxSvc.getCtx( 'preferences' ).EWI_TableOverviewColumnShown;
    policy = workinstrTableSvc.getColumnsPolicy( props, 'ImanItemBOPLine' );
    policy.types[ 0 ].properties.push( additionalProps );
    return policy.types;
};

/**
 * The method to draw the graph. In this method we create all of the nodes and edges
 *
 * @param {Object} graphModel - the graph model
 * @param {Object} rootObject - the root object
 * @param {String} currentStepUid - the current step uid
 */
export const drawGraph = function( graphModel, rootObject, currentStepUid ) {
    m_graphModel = graphModel;

    // Check whether the property Mfg0sub_elements of the root object has been loaded yet or not
    if( ewiService.getModelObjectSubElements( rootObject ) ) {
        m_travelerList = [ rootObject ];
        m_listOfHierarchyEdges = generateHierarchyEdges( rootObject );
        const listOfNodes = generateNodes( rootObject, currentStepUid );
        workinstrGraphService.drawGraph( m_graphModel, listOfNodes, m_listOfHierarchyEdges );
    }
};

/**
 * This method applies the sequential layout on the graph.
 *
 * @param {Object} rootObject - the root object
 *
 * @return {String} the overview type to display Hierarchy/ Sequential/ Table
 */
export const applySequentialLayout = function( rootObject ) {
    if( !m_listOfSequentialEdges ) {
        m_listOfSequentialEdges = generateSequentialEdges( rootObject );
    }
    workinstrGraphService.replaceOldEdgesWithNewEdges( m_graphModel, m_listOfSequentialEdges );
    workinstrGraphService.applyLayout( m_graphModel, graphConstants.GlobalLayoutTypes.Snake, null );

    return 'Sequential';
};

/**
 * This method applies the hierarchy layout to the graph
 *
 * @return {String} the overview type to display Hierarchy/ Sequential/ Table
 */
export const applyHierarchyLayout = function() {
    workinstrGraphService.replaceOldEdgesWithNewEdges( m_graphModel, m_listOfHierarchyEdges );
    workinstrGraphService.applyLayout( m_graphModel, graphConstants.GlobalLayoutTypes.Hierarchical, null );

    return 'Hierarchy';
};

/**
 * This method applies the table layout
 *
 * @return {String} the overview type to display Hierarchy/ Sequential/ Table
 */
export const applyTableLayout = function() {
    return 'Table';
};

/**
 * Get Traveler table rows data
 *
 * @return {ObjectArray} searchResults - the list of all the steps to display in table
 * totalFound - the total number of rows to display in the table
 */
export const getTravelerData = function() {
    return {
        searchResults: m_travelerList,
        totalFound: m_travelerList.length
    };
};

export const navigateToObjectBasedOnGivenNode = function( nodeItem ) {
    if( nodeItem ) {
        const uid = workinstrGraphService.getDataUidFromGivenNode( nodeItem );
        if( uid && uid !== ewiService.getCurrentStep().uid ) {
            ewiService.navigateToSelectedObject( uid );
        }
        return false;
    }
};

/**
 * This methods generates all of the edges that are under the given rootObject with hierarchy layout
 *
 * @param {Object} rootObject - the root object
 *
 * @return {ObjectArray} all the edges that are under the given rootObject
 */
const generateHierarchyEdges = function( rootObject ) {
    let edges = [];
    const subElements = ewiService.getModelObjectSubElements( rootObject );
    if( subElements ) {
        const subElementsArray = subElements.dbValues;
        for( let subElementsIndx in subElementsArray ) {
            const subElementObj = clientDataModelSvc.getObject( subElementsArray[ subElementsIndx ] );
            m_travelerList.push( subElementObj );
            edges.push( workinstrGraphService.createEdgeJson( rootObject, subElementObj ) );
            edges = edges.concat( generateHierarchyEdges( subElementObj ) );
        }
    }
    return edges;
};

/**
 * This methods generates all of the edges that are under the given rootObject with sequential (aka "Snake")
 * layout
 *
 * @param {Object} rootObject - the root object
 *
 * @return {ObjectArray} all the edges that are under the given rootObject
 */
const generateSequentialEdges = function( rootObject ) {
    let edges = [];
    const objectsInDfsOrder = getDFSOrderedList( rootObject );
    const objectsInDfsOrderLen = objectsInDfsOrder.length;
    if( objectsInDfsOrderLen > 1 ) {
        for( let i = 0; i < objectsInDfsOrderLen - 1; i++ ) {
            edges.push( workinstrGraphService.createEdgeJson( objectsInDfsOrder[ i ], objectsInDfsOrder[ i + 1 ] ) );
        }
    }
    return edges;
};

/**
 * This methods generates the nodes that are under the given rootObject
 *
 * @param {Object} rootObject - the root object
 * @param {String} currentStepUid - the current step uid
 *
 * @return {ObjectArray} all the nodes that are under the given rootObject
 */
const generateNodes = function( rootObject, currentStepUid ) {
    let nodes = [];
    nodes
        .push( workinstrGraphService.createNodeJson( rootObject, bindDataToGraphTemplateProperties( rootObject, currentStepUid ) ) );
    const subElements = ewiService.getModelObjectSubElements( rootObject );
    if( subElements ) {
        const subElementsArray = subElements.dbValues;
        for( let subElementsIndx in subElementsArray ) {
            nodes = nodes.concat( generateNodes( clientDataModelSvc.getObject( subElementsArray[ subElementsIndx ] ), currentStepUid ) );
        }
    }
    return nodes;
};

/**
 * This method binds data to the properties that are part of the graph html template
 *
 * @param {Object} nodeObject - a node object
 * @param {String} currentStepUid - the current step uid
 *
 * @return {Object} the properties data
 */
const bindDataToGraphTemplateProperties = function( nodeObject, currentStepUid ) {
    let bindData = {};
    bindData[ workinstrGraphService.bindableProperties.NODE_ID_PROP ] = nodeObject.uid;
    const cellProperties = nodeObject.props.awp0CellProperties;
    bindData[ workinstrGraphService.bindableProperties.NODE_TITLE_PROP ] = cellProperties.uiValues[ 0 ].split( ':' )[ 1 ];

    let nodeProp = cellProperties.uiValues[ 1 ];
    if( nodeProp ) {
        nodeProp = nodeProp.split( ':' )[ 1 ];
        if( !_.isEmpty( nodeProp ) ) {
            bindData[ workinstrGraphService.bindableProperties.NODE_PROPERTY_PROP ] = nodeProp;
        }
    }

    const secondNodeProp = cellProperties.uiValues[ 2 ];
    if( secondNodeProp ) {
        const propVal = secondNodeProp.split( ':' )[ 1 ];
        if( !_.isEmpty( propVal ) ) {
            if( _.isEmpty( nodeProp ) ) {
                bindData[ workinstrGraphService.bindableProperties.NODE_PROPERTY_PROP ] = secondNodeProp.replace( '\\:', ' ' );
            } else {
                bindData[ workinstrGraphService.bindableProperties.NODE_SECOND_PROPERTY_PROP ] = secondNodeProp.replace( '\\:', ' ' );
            }
        }
    }
    bindData[ workinstrGraphService.bindableProperties.IMAGE_PROP ] = getImageUrl( nodeObject );

    if( nodeObject.uid === currentStepUid ) {
        bindData[ workinstrGraphService.bindableProperties.NODE_STROKE_WIDTH_PROP ] = 4;
    } else {
        bindData[ workinstrGraphService.bindableProperties.NODE_STROKE_WIDTH_PROP ] = 2;
    }

    return bindData;
};

/**
 * This method return the image url of a given node object. If an image exists, then we return the url of the
 * image, if not them we return the url of the object type image.
 *
 * @param {Object} nodeObject - a node object
 *
 * @return {String} the image url of a given node object
 */
const getImageUrl = function( nodeObject ) {
    const imageTicket = nodeObject.props.awp0ThumbnailImageTicket.dbValues[ 0 ];
    let imagePath;

    if( imageTicket && imageTicket !== '' ) {
        imagePath = workinstrFileTicketService.getFileURL( imageTicket );
    } else {
        const typeIcon = iconService.getTypeIcon( nodeObject.type );
        if( typeIcon ) {
            const startIndex = typeIcon.indexOf( 'src=' ) + 5;
            const endIndex = typeIcon.indexOf( '"', startIndex );
            imagePath = typeIcon.substring( startIndex, endIndex );
        }
    }

    return imagePath;
};

/**
 * This method returns a list of the root and all elements under it DFS (Depth First Search) order
 *
 * @param {Object} rootObject - the root object
 *
 * @return {ObjectArray} a list of the root and all elements under it
 */
const getDFSOrderedList = function( rootObject ) {
    let list = [];
    list.push( rootObject );
    const subElements = ewiService.getModelObjectSubElements( rootObject );
    if( subElements ) {
        const subElementsArray = subElements.dbValues;
        for( let subElementsIndx in subElementsArray ) {
            list = list.concat( getDFSOrderedList( clientDataModelSvc.getObject( subElementsArray[ subElementsIndx ] ) ) );
        }
    }
    return list;
};

export default {
    drawGraph,
    applySequentialLayout,
    applyHierarchyLayout,
    applyTableLayout,
    getTravelerData,
    navigateToObjectBasedOnGivenNode,
    getOverviewPolicy
};
