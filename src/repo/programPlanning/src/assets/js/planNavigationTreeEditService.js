// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/planNavigationTreeEditService
 */

import _ from 'lodash';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import planNavTreeAddObjectService from 'js/planNavigationTreeAddObjectService';

let exports;

/**
 * Adds the newly created objects to the tree
 *
 * @param {Object} data data
 * @param {Object} eventMap eventMap
 */
export let addCreatedObjects = function( data, eventMap ) {
    var createdObjects = eventMap[ 'cdm.created' ].createdObjects;

    let newPlanObjects = _.filter( createdObjects, object => cmm.isInstanceOf( 'Prg0AbsPlan', object.modelType ) );
    let newEventObjects = _.filter( createdObjects, object => cmm.isInstanceOf( 'Prg0AbsEvent', object.modelType ) );

    // Process new plan objects
    if( !_.isEmpty( newPlanObjects ) ) {
        planNavTreeAddObjectService.addTreeNodesForPlanObjects( data.dataProviders.planNavigationTreeDataProvider, newPlanObjects );
    }

    // Process new event objects
    if( !_.isEmpty( newEventObjects ) ) {
        var groupedEvents = _.groupBy( newEventObjects, function( eventObject ) {
            return eventObject.props.prg0PlanObject.dbValues[ 0 ];
        } );

        for( let parentUid in groupedEvents ) {
            let newEvents = groupedEvents[ parentUid ];

            let loadedTreeNodes = data.dataProviders.planNavigationTreeDataProvider.viewModelCollection.loadedVMObjects;
            let index = _.findIndex( loadedTreeNodes, function( node ) {
                return node.uid === parentUid;
            } );

            if( index > -1 ) {
                if( !loadedTreeNodes[ index ].events ) {
                    loadedTreeNodes[ index ].events = [];
                }
                loadedTreeNodes[ index ].events.push.apply( loadedTreeNodes[ index ].events, newEvents );
                loadedTreeNodes[ index ].events.sort( ( a, b ) => a.props.prg0PlannedDate.dbValues[ 0 ] > b.props.prg0PlannedDate.dbValues[ 0 ] ? 1 : -1 );
                eventBus.publish( 'planNavigationTree.eventsAdded', { addedEvents: newEvents } );
            }
        }
    }
};

/**
 *  Removes the deleted objects
 *
 * @param {Object} data
 * @param {Object} eventMap
 */
export let removeDeletedObjects = ( data, eventMap ) => {
    let deletedObjectUids = eventMap[ 'cdm.deleted' ].deletedObjectUids;

    // Clean up deleted events and child nodes.
    if( deletedObjectUids.length > 0 ) {
        let treeNodes = data.dataProviders.planNavigationTreeDataProvider.viewModelCollection.loadedVMObjects;
        treeNodes.forEach( node => {
            if( node.events ) {
                _.remove( node.events, event => deletedObjectUids.includes( event.uid ) );
            }
            let deletedChildren = _.remove( node.children, node => deletedObjectUids.includes( node.uid ) );
            updateVmoForDeletedChildren( node, deletedChildren.length );
        } );
        eventBus.publish( 'planNavigationTree.nodesRemoved', { removedNodeUids: deletedObjectUids } );
    }
};

/**
 * Update the given VMO's total child count and child index of it's children
 * @param {*} vmo The VMO to update
 * @param {*} nDeletedChildren Number of deleted children
 */
let updateVmoForDeletedChildren = ( vmo, nDeletedChildren ) => {
    if( nDeletedChildren <= 0 ) {
        return;
    }
    if( vmo.children.length === 0 ) {
        vmo.isLeaf = true;
        delete vmo.isExpanded;
        delete vmo.totalChildCount;
        delete vmo.children;
    } else {
        for( let index = 0; index < vmo.children.length; ++index ) {
            vmo.children[ index ].childNdx = index;
        }
        vmo.totalChildCount -= nDeletedChildren;
    }
};

exports = {
    addCreatedObjects,
    removeDeletedObjects
};

export default exports;
