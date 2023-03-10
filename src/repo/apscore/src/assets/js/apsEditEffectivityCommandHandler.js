// Copyright (c) 2022 Siemens

/**
 * This is the command handler for "Edit Effectivity" cell command
 *
 * @module js/apsEditEffectivityCommandHandler
 */
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import viewModelService from 'js/viewModelService';

var exports = {};

/**
 * Set command context for "Edit Effectivity" cell command
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.cellCommandVisiblilty = isEditPermittedForGivenTypeOfObject( context.effType );
    if( $scope.cellCommandVisiblilty ) {
        setCommandTitle( $scope );
    }
};

/**
 * To verify edit is permitted for given object.
 *
 * @param {Object} type - type
 * @returns {boolean} is edit permitted for given type of object?
 */
function isEditPermittedForGivenTypeOfObject( type ) {
    var isEditPermitted = false;
    if( type === 'Date' || type === 'Unit' ) {
        isEditPermitted = true;
    }
    return isEditPermitted;
}

/**
 * To set command tooltip
 *
 * @param {Object} scope - scope
 */
function setCommandTitle( scope ) {
    var declViewModel = viewModelService.getViewModel( scope, true );
    scope.command.title = declViewModel.i18n.edit;
}

/**
 * Execute the command.
 *
 * @param {Object} vmo - vmo
 * @param {Object} $scope - scope
 */
export let execute = function( vmo, title ) {
    if( appCtxService.ctx.effIntents === undefined ) {
        appCtxService.ctx.effIntents = {};
    }
    appCtxService.ctx.effIntents.isAddEffectivity = false;

    eventBus.publish( 'navigateToEditPanel', vmo );
};

export default exports = {
    setCommandContext,
    execute
};
