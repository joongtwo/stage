// Copyright (c) 2022 Siemens

/**
 * This is the command handler for remove object from cell list.
 *
 * @module js/removeWorkflowOwnerCommandHandler
 */
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Set command context for remove object cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.cellCommandVisiblilty = true;
};

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 */
export let execute = function() {
    eventBus.publish( 'RemoveWorkflowOwner.removeUser' );
};

export let removeWorkflowOwner = function( data, workflowOwner ) {
    if( data.dataProviders ) {
        var dataProvider = data.dataProviders.getAssignedWorkflowOwner;
        if( workflowOwner === dataProvider.viewModelCollection.loadedVMObjects[ 0 ].uid ) {
            eventBus.publish( 'RemoveWorkflowOwner.ownerRemoveError' );
            return;
        }
        let emptyResource = [];
        //Update data provider.
        data.dataProviders.getAssignedWorkflowOwner.update( emptyResource );
    }
    data.workflowOwner = undefined;
};

export default exports = {
    setCommandContext,
    execute,
    removeWorkflowOwner
};
