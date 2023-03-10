// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/planNavigationTreeNodeCreateService
 */
import awIconService from 'js/awIconService';
import awTableSvc from 'js/awTableService';
import cmm from 'soa/kernel/clientMetaModel';

let exports;

/**
 * Creates a VieWModelTreeNode using the given model object info.
 * @param {Object} modelObject - object for creating view model tree node.
 * @param {String} displayName - display name of the tree node
 * @param {String} parentUid - UID of the parent node.
 * @param {int} childNdx - int value for child index.
 * @param {int} levelNdx - int value for level index.
 * @return {Object} vmNode A view model node object containing the details of the node.
 */
export let createViewModelTreeNodeUsingModelObject = ( modelObject, displayName, parentUid, childNdx, levelNdx, declViewModel ) => {
    let iconURL = awIconService.getTypeIconFileUrl( modelObject );
    let vmNode = awTableSvc.createViewModelTreeNode( modelObject.uid, modelObject.type, displayName, levelNdx, childNdx, iconURL );
    let hasChildren = containChildren( modelObject, declViewModel );
    vmNode.isLeaf = !hasChildren;
    vmNode.alternateID = vmNode.uid;
    vmNode.parentNodeUid = parentUid;
    vmNode.events = [];
    return vmNode;
};

/**
 * function to evaluate if an object contains children
 * @param {objectType} object object
 * @return {boolean} if node contains child
 */
let containChildren = function( object, declViewModel ) {
    //Check if there are column filters
    let columnFilters = [];
    if( declViewModel && declViewModel.columnProviders.planNavigationTreeColumnProvider ) {
        columnFilters = declViewModel.columnProviders.planNavigationTreeColumnProvider.columnFilters;
        if( columnFilters && columnFilters.length > 0 ) {
            return false;
        }
    }

    if( cmm.isInstanceOf( 'Prg0AbsPlan', object.modelType ) && object.props.pgp0NumberOfChildren ) {
        return object.props.pgp0NumberOfChildren.dbValues[ 0 ] > 0;
    }
    return false;
};

exports = {
    createViewModelTreeNodeUsingModelObject
};

export default exports;
