// Copyright (c) 2022 Siemens

/**
 * Simple Alert service for sample command Handlers
 *
 * @module js/PredictiveUtils
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxService from 'js/appCtxService';
import browserUtils from 'js/browserUtils';
import AwHttpService from 'js/awHttpService';
import clipboardService from 'js/clipboardService';
import soa_preferenceService from 'soa/preferenceService';
import viewModelObjectService from 'js/viewModelObjectService';
import tabRegistryService from 'js/tabRegistry.service';
import commandHighlightService from 'js/commandHighlightService';
import messageService from 'js/messagingService';
import wcagService from 'js/wcagService';
import htmlUtils from 'js/htmlUtils';
import cas from 'js/centralAggregationService';

var microServiceURLPredictionService = 'tc/micro/cps/commandprediction/v2/commands';
var microServiceURLTrainingService = 'tc/micro/cps/commandprediction/history';
var microServiceURLLikeService = 'tc/micro/cps/commandprediction/commands/like';
var microServiceURLDisLikeService = 'tc/micro/cps/commandprediction/commands/dislike';

var exports = {};
var _appCtxService = appCtxService;
var predictiveInfo = {};
var lastUserEventTimer = {};
var lastAppEvent = {};
var predictions = [];
var _idleEventListener;
var expertMode = false;
let _enabled = true;
var expertTimer = null;
let _observer;
let _timeoutID;
/**
 * This array holds a list of command objects to be logged into the Command Prediction Training server.
 *
 * @type {Array}
 * @private
 */
let _logCommandsList = {
    commandData: []
};
let post = function( body, url, headers ) {
    if( isAWAEnabled() ) {
        var $http = AwHttpService.instance;
        return $http.post( browserUtils.getBaseURL() + url, body, {
            headers: headers
        } );
    }
};

export let expertModeEnabled = function( setexpertMode, showTutorRibbon, data ) {
    expertMode = _.clone( setexpertMode );
    let tutorRibbonStatus = _.clone( showTutorRibbon );
    if( expertMode === true ) {
        //Condition to enable tutor mode rubbon
        tutorRibbonStatus = true;
        if( _appCtxService.ctx.preferences.AWA_expert_notification_timeout !== undefined ) {
            data.expertTimeout = _appCtxService.ctx.preferences.AWA_expert_notification_timeout[ 0 ];
        }
        expertTimer = setTimeout( function() {
            if( data.expertButton.dbValue === true ) {
                messageService.showInfo( data.i18n.TutorModeReminder );
            }
            expertModeEnabled( expertMode, tutorRibbonStatus, data );
        }, data.expertTimeout * 1000 );
    } else {
        clearTimeout( expertTimer );
        tutorRibbonStatus = false;
    }
    return { newExpertButtonDbValue: expertMode, tutorRibbonStatus: tutorRibbonStatus };
};

export let promptExpert = function( expertButton, showTutorRibbon, data ) {
    let newExpertButton = _.clone( expertButton );
    let tutorRibbonStatus = _.clone( showTutorRibbon );
    var globalNavPanel = _appCtxService.ctx.awSidenavConfig.globalSidenavContext.globalNavigationSideNav;
    if( globalNavPanel.pinned !== true || globalNavPanel.open !== true ) {
        if( newExpertButton.dbValue === true ) {
            messageService.showInfo( data.i18n.TutorModeDisabled );
        }
        tutorRibbonStatus = false;
        newExpertButton.dbValue = false;
        expertMode = false;
    }
    return { newExpertButtonDbValue: newExpertButton.dbValue, tutorRibbonStatus: tutorRibbonStatus };
};

let isAWAEnabled = function() {
    if( _appCtxService.ctx.preferences &&
        _appCtxService.ctx.preferences.AWA_is_feature_installed && _appCtxService.ctx.preferences.AWA_is_feature_installed[ 0 ] === 'true' ) {
        return true;
    }
    return false;
};

let getCurrentPrimarySublocation = function() {
    var selectedTab = {};
    var tabSet = tabRegistryService.getVisibleTabs( 'primary' );
    if( tabSet !== null ) {
        for( let index = 0; index < tabSet.length; index++ ) {
            if( tabSet[ index ].selectedTab === true ) {
                selectedTab = tabSet[ index ];
                break;
            }
        }
        return selectedTab;
    }
    return {
        state: appCtxService.ctx.sublocation.historyNameToken
    };
};

let addCommandData = function( commandObject, commandInfo ) {
    for( const key in commandInfo ) {
        if( Object.hasOwnProperty.call( commandInfo, key ) ) {
            let propArray = {
                identityParamName: key,
                identityParamValue: commandInfo[ key ]
            };
            commandObject.push( propArray );
        }
    }
};

let getCurrentCommandObject = function( eventData ) {
    var selectedTab = getCurrentPrimarySublocation();
    var prevInfo = {
        actionType: 'tab',
        tabKey: selectedTab.state ? selectedTab.state : selectedTab.tabKey,
        tabSetId: 'primary',
        parentTabs: 'ANYVALUE'
    };
    predictiveInfo.previousCommand = [];
    if( !Object.hasOwnProperty.call( eventData, 'userGesture' ) ) {
        if( Object.hasOwnProperty.call( predictiveInfo, 'currentCommand' ) && predictiveInfo.currentLocation === prevInfo.tabKey ) {
            predictiveInfo.previousCommand = predictiveInfo.currentCommand;
        } else {
            addCommandData( predictiveInfo.previousCommand, prevInfo );
        }
        predictiveInfo.currentCommand = [];
        var commandInfo = {
            actionType: 'command',
            cmdID: eventData.commands[ 0 ].cmdId ? eventData.commands[ 0 ].cmdId : 'ANYVALUE',
            cmdBarAnchor: eventData.commands[ 0 ].cmdBarAnchor ? eventData.commands[ 0 ].cmdBarAnchor : 'ANYVALUE',
            cmdSectionTitle: eventData.sectionTitleKey ? eventData.sectionTitleKey : 'ANYVALUE',
            parentTabs: 'ANYVALUE'
        };
        if( eventData.parentTabs && eventData.parentTabs !== [] ) {
            eventData.parentTabs.forEach( tab => {
                commandInfo.parentTabs += tab.tabSetId + ':' + tab.tabKey;
            } );
        }
    }
    addCommandData( predictiveInfo.currentCommand, commandInfo );
    return {
        commandData: predictiveInfo,
        expertMode: expertMode
    };
};

let getCurrentTabObject = function( eventData ) {
    var selectedTab = getCurrentPrimarySublocation();
    predictiveInfo.previousCommand = [];
    if( Object.hasOwnProperty.call( eventData, 'userGesture' ) ) {
        var prevInfo = {
            actionType: 'auto',
            tabKey: 'ANYCOMMAND'
        };
    } else {
        var prevInfo = {
            actionType: 'tab',
            tabKey: selectedTab.state ? selectedTab.state : selectedTab.tabKey,
            tabSetId: 'primary',
            parentTabs: 'ANYVALUE'
        };
    }
    addCommandData( predictiveInfo.previousCommand, prevInfo );
    predictiveInfo.currentCommand = [];
    var commandInfo = {
        actionType: 'tab',
        tabKey: eventData.tabKey,
        tabSetId: eventData.tabSetId,
        parentTabs: 'ANYVALUE'
    };
    if( eventData.parentTabs && eventData.parentTabs !== [] ) {
        eventData.parentTabs.forEach( tab => {
            commandInfo.parentTabs += tab.tabSetId + ':' + tab.tabKey;
        } );
    }
    addCommandData( predictiveInfo.currentCommand, commandInfo );
    predictiveInfo.nextLocation = commandInfo.tabKey;
    return {
        commandData: predictiveInfo,
        expertMode: expertMode
    };
};

let getCurrentTileObject = function( eventData ) {
    var selectedTab = getCurrentPrimarySublocation();
    predictiveInfo.previousCommand = [];
    var prevInfo = {
        actionType: 'tab',
        tabKey: selectedTab.state ? selectedTab.state : selectedTab.tabKey,
        tabSetId: 'primary',
        parentTabs: 'ANYVALUE'
    };
    addCommandData( predictiveInfo.previousCommand, prevInfo );
    predictiveInfo.currentCommand = [];
    var commandInfo = {
        actionType: 'tile',
        tileId: eventData.tileId
    };
    addCommandData( predictiveInfo.currentCommand, commandInfo );
    return {
        commandData: predictiveInfo,
        expertMode: expertMode
    };
};

let getCommandParameterInfo = function( actionType, eventData ) {
    var payload = {};
    switch ( actionType ) {
        case 'tile':
            getAppContextInfo( eventData );
            payload = getCurrentTileObject( eventData );
            break;
        case 'tab':
            getAppContextInfo( eventData );
            payload = getCurrentTabObject( eventData );
            break;
        case 'command':
            getAppContextInfo( eventData );
            payload = getCurrentCommandObject( eventData );
            break;
    }
    return payload;
};

let getAppContextInfo = function( eventData ) {
    var selectedTab = getCurrentPrimarySublocation();
    predictiveInfo.user = eventData.user;
    predictiveInfo.role = eventData.role;
    predictiveInfo.group = eventData.group;
    predictiveInfo.workspace = eventData.workspace;
    predictiveInfo.objectType = eventData.selectedType;
    predictiveInfo.selectionMode = eventData.selectionMode;
    predictiveInfo.currentLocation = selectedTab.state ? selectedTab.state : selectedTab.tabKey;
    predictiveInfo.nextLocation = selectedTab.state ? selectedTab.state : selectedTab.tabKey;
    predictiveInfo.objectContext = JSON.stringify( eventData );
};

export let serviceCall = function( eventData, oldPredictions ) {
    var newPredictions = _.clone( oldPredictions );
    newPredictions = eventData;
    return newPredictions;
};

export let refreshPredictions = function( oldPredictions ) {
    var newPredictions = [];
    if( !_.isEmpty( lastAppEvent ) && payloadNullCheck( lastAppEvent ) ) {
        post( lastAppEvent, microServiceURLPredictionService, {} ).then( function( res ) {
            if( res.data.predictions.length > 0 ) {
                res.data.predictions.forEach( prediction => {
                    newPredictions.push( JSON.parse( prediction.objectContext ) );
                } );
            }
            eventBus.publish( 'populatePrediction', newPredictions );
            lastAppEvent = {};
        } );
    }
};

let commandPreferenceCheck = function( commandID ) {
    if( soa_preferenceService.getLoadedPrefs().AWA_valid_list_of_commands_to_skip &&
        soa_preferenceService.getLoadedPrefs().AWA_valid_list_of_commands_to_skip.indexOf( commandID ) < 0 ) {
        return true;
    }
    return false;
};

let commandAnchorPreferenceCheck = function( anchor ) {
    if( soa_preferenceService.getLoadedPrefs().AWA_valid_list_of_command_anchors_to_process &&
        soa_preferenceService.getLoadedPrefs().AWA_valid_list_of_command_anchors_to_process.indexOf( anchor ) > -1 &&
        !anchor.includes( 'awa_dataAssistantPanel' ) ) {
        return true;
    }
    return false;
};

let payloadNullCheck = function( payload ) {
    var status = true;
    if( !payload.commandData.currentCommand || payload.commandData.currentCommand === [] ) { status = false; }
    if( !payload.commandData.previousCommand || payload.commandData.previousCommand === [] ) { status = false; }
    if( !payload.commandData.currentLocation || payload.commandData.currentLocation === [] ) { status = false; }
    if( !payload.commandData.nextLocation || payload.commandData.nextLocation === [] ) { status = false; }
    if( !payload.commandData.objectContext || payload.commandData.objectContext === [] ) { status = false; }
    return status;
};

export let notify = function( eventData ) {
    var actionType = eventData.type;
    if( isAWAEnabled() === true ) {
        var newPredictions = [];
        var payload = {};
        switch ( actionType ) {
            case 'tile':
                getAppContextInfo( eventData );
                payload = getCurrentTileObject( eventData );
                lastAppEvent = payload;
                break;
            case 'tab':
                getAppContextInfo( eventData );
                payload = getCurrentTabObject( eventData );
                lastAppEvent = payload;
                break;
            case 'command':
                if( eventData.commands.length !== 0 ) {
                    if( commandPreferenceCheck( eventData.commands[ 0 ].cmdId ) && commandAnchorPreferenceCheck( eventData.commands[ 0 ].cmdBarAnchor ) && eventData.isGroupCommand === 'false' ) {
                        getAppContextInfo( eventData );
                        payload = getCurrentCommandObject( eventData );
                        lastAppEvent = payload;
                    }
                }
                break;
        }
        if( !_.isEmpty( payload ) && payloadNullCheck( payload ) ) {
            if( _enabled === true ) {
                if( !Object.hasOwnProperty.call( eventData, 'userGesture' ) ) {
                    post( lastAppEvent, microServiceURLPredictionService, {} ).then( function( res ) {
                        if( res.data.predictions.length > 0 ) {
                            res.data.predictions.forEach( prediction => {
                                newPredictions.push( JSON.parse( prediction.objectContext ) );
                            } );
                        }
                        eventBus.publish( 'populatePrediction', newPredictions );
                    } );
                }
            } else {
                _logCommandsList.commandData.push( _.clone( payload.commandData ) );
            }
        }
    }
};

export let populatePredictions = function() {
    var selectedTab = getCurrentPrimarySublocation();
    notify( {
        type: 'tab',
        userGesture: false,
        tabKey: selectedTab.state ? selectedTab.state : selectedTab.tabKey,
        tabSetId: 'primary',
        ...cas.getCurrentApplicationContext()
    } );
};

export let stateChangeEventListener = function( eventData ) {
    var activeTab = checkActiveTab();
    if( Object.hasOwnProperty.call( eventData, 'value' ) && activeTab !== predictiveInfo.currentLocation ) {
        populatePredictions();
    }
};

let checkActiveTab = function() {
    var tabs = tabRegistryService.getVisibleTabs( 'primary' );
    var activeTab = null;
    if( tabs !== null ) {
        for( let index = 0; index < tabs.length; index++ ) {
            if( tabs[ index ].selectedTab === true ) {
                activeTab = tabs[ index ];
                break;
            }
        }
    }
    if( activeTab === null ) {
        return null;
    }
    return activeTab.state ? activeTab.state : activeTab.tabKey;
};

export let tabChangeEventListener = function() {
    var activeTab = checkActiveTab();
    if( activeTab !== null && activeTab !== predictiveInfo.currentLocation ) {
        populatePredictions();
    }
};

export let selectionChangeEventListener = function( eventData ) {
    var selectedTab = getCurrentPrimarySublocation();
    if( Object.hasOwnProperty.call( eventData, 'value' ) ) {
        notify( {
            type: 'tab',
            userGesture: false,
            tabKey: selectedTab.state ? selectedTab.state : selectedTab.tabKey,
            tabSetId: 'primary',
            ...cas.getCurrentApplicationContext()
        } );
    }
};

/**
 * This method should be called when the client determines that Training Prediction service should be disabled.
 */
export let enablePrediction = function() {
    if( !_enabled && isAWAEnabled() ) {
        // Force commit all pending commands info in command queue
        eventBus.unsubscribe( 'prediction-idle' );
        _logEventDataAtIdle();
        _enabled = true;
        populatePredictions();
    }
};
/**
 * This method should be called when the client determines that Training Prediction service should be enabled.
 */
export let disablePrediction = function() {
    if( _enabled ) {
        _enabled = false;
        // Subscribe to events for logging.
        _idleEventListener = eventBus.subscribe( 'prediction-idle', _logEventDataAtIdle );
    }
};

/**
 * This method logs all the data stored by _logCommandsList in FIFO during Idle time.
 *
 */
function _logEventDataAtIdle() {
    if( !_enabled && isAWAEnabled() && _logCommandsList.commandData.length !== 0 ) {
        // make service call with command data
        post( _logCommandsList, microServiceURLTrainingService, {} ).then( function() {
            _logCommandsList.commandData = [];
        } );
    }
}
/**
 * This method should be called when the client determines that Training Prediction service should be enabled.
 */
export let init = function() {
    //initiate command logging
    exports.disablePrediction();
    //initiate timer for idle state
    _idleSetup();
};

export let updateMaxCount = function( maxCount, type ) {
    let newMaxCount = _.clone( maxCount );
    if( type === 'MyRecent' ) {
        return { newMaxCount : 20 };
    } else if( type === 'TeamRecent' ) {
        if( appCtxService.ctx.preferences && appCtxService.ctx.preferences.AWA_max_recent_objects_count && appCtxService.ctx.preferences.AWA_max_recent_objects_count.length > 0 ) {
            maxCount = parseInt( appCtxService.ctx.preferences.AWA_max_recent_objects_count[ 0 ] );
        } else {
            return { newMaxCount : 20 };
        }
    } else if( type === 'Favorites' ) {
        return { newMaxCount : 20 };
    }
};

export let updateClipboardContent = function() {
    var clipboardViewModelObjects = [];
    var clipboardObjects = clipboardService.instance.getCachableObjects();
    if( clipboardObjects.length > 0 ) {
        clipboardObjects.forEach( obj => {
            var vmo = viewModelObjectService.constructViewModelObjectFromModelObject( obj );
            clipboardViewModelObjects.push( vmo );
        } );
    }
    return {
        awaClipboardContent: clipboardViewModelObjects
    };
};

export let likePrediction = ( commandContext ) => {
    var payload = getCommandParameterInfo( commandContext.type, commandContext.widgetData );
    post( payload, microServiceURLLikeService, {} );
    eventBus.publish( 'predictionLiked', commandContext );
};

export let dislikePrediction = ( commandContext ) => {
    var payload = getCommandParameterInfo( commandContext.type, commandContext.widgetData );
    post( payload, microServiceURLDisLikeService, {} );
    eventBus.publish( 'predictionDisliked', commandContext );
};

export let highlightPrediction = ( commandContext ) => {
    if( commandContext.type === 'command' ) {
        let commands;
        if( commandContext.commands ) {
            commands = commandContext.commands.reverse();
        }
        commandHighlightService.highlightCommand( commandContext.id, commandContext.xpath, commands );
    } else if( commandContext.type === 'tile' ) {
        let tileElement = htmlUtils.getElementByXpath( commandContext.xpath, document.body );
        if( tileElement ) {
            wcagService.afxFocusElement( tileElement );
        }
    } else if( commandContext.type === 'tab' ) {
        tabRegistryService.highlightTabBasedOnXPath( commandContext.id, commandContext.xpath );
    }
};

let idleCutoff = function() {
    return _enabled ? 0.5 : 5;
};

/**
 * This waits for either a "progress.start" or "progress.end" event to come in and once they do, it starts up an idle event publisher.
 */
function _idleSetup() {
    /**
     * @param {String|null} endPoint - optional endPoint of the progress event
     */
    function processEvent( endPoint ) {
        if( !/\/getUnreadMessages$/.test( endPoint ) ) {
            eventBus.unsubscribe( progressStartListener );
            eventBus.unsubscribe( progressEndListener );
            _startupIdleEventPublisher();
        }
    }
    var progressStartListener = eventBus.subscribe( 'progress.start', processEvent );
    var progressEndListener = eventBus.subscribe( 'progress.end', processEvent );
}
/**
 * Sets up an Idle event publisher. This publisher uses a burndown timer which checks how long it has been since a "progress.end" or "progress.start"
 * event has come in. If one of those events come in, the burndown timer is restarted. Once the burndown exceeds its timer it will fire a single "idle"
 * event and then resume listening for a "progress.end"/"progress.start" event.
 */
function _startupIdleEventPublisher() {
    var idleBurndown;
    /**
     */
    function processEvent() {
        clearTimeout( idleBurndown );
        idleBurndown = _setupBurndownTimer( 'prediction-idle', idleCutoff(), _idleSetup, progressStartListener, progressEndListener );
    }
    var progressStartListener = eventBus.subscribe( 'progress.start', processEvent );
    var progressEndListener = eventBus.subscribe( 'progress.end', processEvent );
    idleBurndown = _setupBurndownTimer( 'prediction-idle', idleCutoff(), _idleSetup, progressStartListener, progressEndListener );
}

/**
 * Creates the burndown timer
 *
 * @param {Object} progressStartListener - eventBus subscription handle
 * @param {Object} progressEndListener - eventBus subscription handle
 * @return {Number} A Number, representing the ID value of the timer that is set. Use this value with the clearTimeout() method to cancel the timer.
 */
function _setupBurndownTimer( publishText, idle_cutoff_seconds, runFunction, progressStartListener, progressEndListener ) {
    // var idle_cutoff_seconds = 1.5;
    return setTimeout( function() {
        eventBus.publish( publishText, {} );
        runFunction();
        eventBus.unsubscribe( progressStartListener );
        eventBus.unsubscribe( progressEndListener );
    }, idle_cutoff_seconds * 1000 );
}

/**
 * Updates the data assistant current value
 *
 * @param {Object} dataAssistantSelectionData - Selection data
 * @return {Number} A Number, representing the ID value of the timer that is set. Use this value with the clearTimeout() method to cancel the timer.
 */
function handleSelectionChange( dataAssistantSelectionData ) {
    return { currentDataAssistantOption: dataAssistantSelectionData.selected[ 0 ].dbValue };
}

export default exports = {
    serviceCall,
    enablePrediction,
    disablePrediction,
    init,
    notify,
    updateMaxCount,
    updateClipboardContent,
    expertModeEnabled,
    promptExpert,
    likePrediction,
    dislikePrediction,
    highlightPrediction,
    stateChangeEventListener,
    selectionChangeEventListener,
    tabChangeEventListener,
    handleSelectionChange,
    refreshPredictions
};
