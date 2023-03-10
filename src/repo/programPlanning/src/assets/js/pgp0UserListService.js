// Copyright (c) 2022 Siemens

/**
 * @module js/pgp0UserListService
 */
import cdm from 'soa/kernel/clientDataModel';
import selectionService from 'js/selection.service';

var exports = {};

export let processObjectsToDelete = () => {
    var mselected = selectionService.getSelection().selected;
    let pselected = selectionService.getSelection().parent;
    return {
        deletedObjectName: mselected.length > 0 ? mselected[ 0 ].props.object_name.uiValues[ 0 ] : '',
        deleteObjects: mselected,
        parentSelection: pselected ? pselected : mselected[ 0 ]
    };
};

/**
 * prepare the input for the set properties SOA call to add the responsible User
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 */
export let addResponsibleUser = function( selectedResources, ctx ) {
    var inputData = [];

    var selected = ctx.mselected;

    selected.forEach( function( selectedTask ) {
        var infoObj = {};

        infoObj.object = cdm.getObject( selectedTask.uid );

        infoObj.timestamp = '';

        var temp = {};

        temp.name = 'fnd0ResponsibleUser';
        temp.values = [ selectedResources[ 0 ].props.user.dbValue ];

        var vecNameVal = [];
        vecNameVal.push( temp );

        infoObj.vecNameVal = vecNameVal;

        inputData.push( infoObj );
    } );

    return inputData;
};

/**
 * For checking the state of the event for multiselect delete warning msg
 * @param {data} data - The qualified data of the viewModel
 */
export let checkStateOfEventForDeletion = function( data ) {
    var selection = selectionService.getSelection().selected;
    var len = selection.length;
    var i;
    data.eventStateFlag = true;
    if( selection && len > 0 ) {
        for( i = 0; i < len; i++ ) {
            if( selection[ i ].props.prg0State.dbValues[ 0 ] !== 'Not Started' ) {
                data.eventStateFlag = false;
                break;
            }
        }
    }
};

/**
 * Utility method to get the initial selection Uid string.
 *
 * @param {String} selectedUid Initial selection Uid
 * @returns {String} Initial selection Uid string
 */
export const cacheSelection = selectedUid => {
    return selectedUid;
};

/**
 * Update the people picker search criteria based on selected target object uid to show people based
 * on project.
 *
 * @param {Object} userPanelContext User panel state context object where criteria need to be updated
 * @param {Object} criteriaObject Contains the keys that need to be updated in search criteria
 */
export let updateUserPanelSearchStateCriteria = function( userPanelContext, criteriaObject ) {
    const userPanelState = { ...userPanelContext };
    var criteria = userPanelState.criteria;
    if( userPanelContext && criteriaObject ) {
        for( const key of Object.keys( criteriaObject ) ) {
            if( criteriaObject[ key ] ) {
                criteria[ key ] = criteriaObject[ key ];
            }
        }
    }
    userPanelState.criteria = criteria;

    return {
        userPanelState : userPanelState,
        isDataInit : true
    };
};

export default exports = {
    processObjectsToDelete,
    addResponsibleUser,
    checkStateOfEventForDeletion,
    cacheSelection,
    updateUserPanelSearchStateCriteria
};
