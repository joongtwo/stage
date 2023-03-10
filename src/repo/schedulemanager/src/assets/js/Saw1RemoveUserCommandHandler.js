// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1RemoveUserCommandHandler
 */
import _ from 'lodash';
import $ from 'jquery';
import eventBus from 'js/eventBus';

var exports = {};
var _assignUsers = [];

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let execute = function( vmo ) {
    if( vmo && vmo.uid ) {
        _assignUsers.push( vmo );
        eventBus.publish( 'Saw1RemoveUserCommand.removeUser' );
    }

    if( vmo && vmo.length > 0 ) {
        _.forEach( vmo, function( user ) {
            _assignUsers.push( user );
        } );
        eventBus.publish( 'Saw1RemoveUserCommand.removeUser' );
    }
};

/**
 * Remove User .Called when clicked on the remove cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let removeUser = function( data ) {
    _.forEach( _assignUsers, function( assignUser ) {
        removeFromAssignedUsers( data, assignUser );
        if( data.dataProviders.userPerformSearch ) {
            var updateAvailableList = data.dataProviders.userPerformSearch.viewModelCollection.loadedVMObjects;
            updateAvailableList.push( assignUser );
            data.dataProviders.userPerformSearch.update( updateAvailableList );
        }
    } );
};

/**
 * Method to remove Users from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAssignedUsers( data, vmo ) {
    var removeUsersUid = [];
    removeUsersUid.push( vmo.uid );
    var memberModelObjects = data.dataProviders.assignedUserList.viewModelCollection.loadedVMObjects;

    var modelObjects = $.grep( memberModelObjects, function( eachObject ) {
        return $.inArray( eachObject.uid, removeUsersUid ) === -1;
    } );
    data.dataProviders.assignedUserList.update( modelObjects );
}

/**
 * Remove User .Called when clicked on the remove cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let removeScheduleMember = function( data ) {
    removeFromAssignedScheduleMember( data, _assignUsers );
    var updateAvailableList = data.dataProviders.userPerformSearch.viewModelCollection.loadedVMObjects;

    var index = _.findIndex( updateAvailableList, function( memberObj ) {
        return memberObj.uid === _assignUsers.uid;
    } );
    data.visibleSaveBtn = true;
    if( index > -1 ) {
        return;
    }
    updateAvailableList.push( _assignUsers );
    data.dataProviders.userPerformSearch.update( updateAvailableList );
};

/**
 * Method to remove Users from available section of panel
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
function removeFromAssignedScheduleMember( data, vmo ) {
    var removeUsersUid = [];
    removeUsersUid.push( vmo.uid );
    var memberModelObjects = data.dataProviders.assignedScheduleMemberList.viewModelCollection.loadedVMObjects;

    var modelObjects = $.grep( memberModelObjects, function( eachObject ) {
        return $.inArray( eachObject.uid, removeUsersUid ) === -1;
    } );
    data.dataProviders.assignedScheduleMemberList.update( modelObjects );
}

/**
 * Set command context for show object cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.cellCommandVisiblilty = true;
};

exports = {
    execute,
    removeUser,
    removeScheduleMember,
    setCommandContext
};
export default exports;
