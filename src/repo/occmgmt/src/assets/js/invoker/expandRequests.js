// Copyright (c) 2022 Siemens

/**
 * Facilitates tree loading in background when server is idle.
 *
 * @module js/invoker/expandRequests
 */

import ExpandBelowCallProvider from 'js/invoker/expandBelowCallProvider';
import ExpandOneCallProvider from 'js/invoker/expandOneCallProvider';
import PropertyCallProvider from 'js/invoker/propertyCallProvider';
import ReconfigureWindowCallProvider from 'js/invoker/reconfigureWindowCallProvider';
import requestQueue from 'js/invoker/requestQueue';

/**
 * Trigger calls for reconfiguration of current window
 * @param {String} gesture Gesture name
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 *     if optional uwDataProvider is supplied, property load will be prioritised by focus
 */
export const reconfigureWindow = function( gesture, commandContext ) {
    let invokerId = 'ReconfigureWindow';
    let expansionCriteria = {
        expandBelow: false,
        loadTreeHierarchyThreshold: 500,
        levelsToExpand: 1
    };
    let chain2 = new PropertyCallProvider( commandContext, null );
    let chain1 = new ReconfigureWindowCallProvider( commandContext.occContext, expansionCriteria, chain2 );
    requestQueue.queue( invokerId, chain1, { replace: true } );
};

/**
 * Trigger calls for expand below of current window
 * @param {String} parentNode Top VMO or VMTN
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 *     if optional uwDataProvider is supplied, property load will be prioritised by focus
 * @param {Object} expansionCriteria optional expansionCriteria may include
 *                  { scopeForExpandBelow, levelsToExpand }
 */
export const expandBelow = function( parentNode, commandContext, expansionCriteria ) {
    let invokerId = 'ExpandBelow_' + parentNode.uid;
    let chain2 = new PropertyCallProvider( commandContext, null );
    let chain1 = new ExpandBelowCallProvider( parentNode, commandContext.occContext, expansionCriteria, chain2 );
    requestQueue.queue( invokerId, chain1, { replace: true } );
};

/**
 * Trigger calls for expand single parent in current window
 * @param {String} parentNode Top VMO or VMTN
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 *     if optional uwDataProvider is supplied, property load will be prioritised by focus
 */
export const expandOne = function( parentNode, commandContext ) {
    let invokerId = 'ExpandOne_' + parentNode.uid;
    let expansionCriteria = {
        expandBelow: false,
        loadTreeHierarchyThreshold: 500,
        levelsToExpand: 1
    };
    let chain2 = new PropertyCallProvider( commandContext, null );
    let chain1 = new ExpandOneCallProvider( parentNode, commandContext.occContext, expansionCriteria, chain2 );
    requestQueue.queue( invokerId, chain1, { queue: true } );
};

/**
 * Trigger calls for loading tree properties in background
 * @param {Object} commandContext Must contain clientScopeURI and occContext
 */
export const loadTreePropertiesInBackground = function( commandContext ) {
    let invokerId = 'TreePropertiesInBackground_';
    let chain1 = new PropertyCallProvider( commandContext, null );
    requestQueue.queue( invokerId, chain1, { queue: true } );
};

export const reconfigureEnabled = function( occContext ) {
    if( occContext && occContext.ReconfigureDebug ) {
        return occContext.ReconfigureDebug === 'true';
    }
    return false;
};

export const expandBelowEnabled = function( occContext ) {
    if( occContext && occContext.ExpandBelowDebug ) {
        return occContext.ExpandBelowDebug === 'true';
    }
    return false;
};

export const expandOneEnabled = function( occContext ) {
    if( occContext && occContext.ExpandOneDebug ) {
        return occContext.ExpandOneDebug === 'true';
    }
    return false;
};

export const loadTreePropertiesInBackgroundEnabled = function( occContext ) {
    if( occContext && occContext.LoadTreePropsDebug && occContext.LoadTreePropsTimerDebug ) {
        return occContext.LoadTreePropsDebug === 'true' || occContext.LoadTreePropsTimerDebug === 'true';
    }
    return false;
};

var exports = {
    reconfigureWindow,
    reconfigureEnabled,
    expandBelow,
    expandBelowEnabled,
    expandOne,
    expandOneEnabled,
    loadTreePropertiesInBackground,
    loadTreePropertiesInBackgroundEnabled
};
export default exports;
