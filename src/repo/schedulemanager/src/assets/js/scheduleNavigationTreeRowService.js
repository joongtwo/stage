// Copyright (c) 2022 Siemens

/**
 * @module js/scheduleNavigationTreeRowService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import schNavigationDepCacheService from 'js/ScheduleNavigationDependencyCacheService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import smConstants from 'js/ScheduleManagerConstants';
import AwPromiseService from 'js/awPromiseService';
import viewModelService from 'js/viewModelService';
import schNavTreeUtils from 'js/scheduleNavigationTreeUtils';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

let scheduleTaskProcessed = [];

let newDependenciesWithDisplayValues = [];

export let subscribeEvents = () => {
    let eventSubscriptions = [];

    // Handle the nodes being loaded
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTreeDataProvider.treeNodesLoaded', eventData => {
        regenerateDependencyIds();
    } ) );

    // Handle new nodes being added
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesAdded', eventData => {
        if( eventData.dataProvider !== undefined ) {
            let vmCollection = eventData.dataProvider.viewModelCollection;
            for( let i = 0; i < eventData.addedNodes.length; i++ ) {
                let index = vmCollection.findViewModelObjectById( eventData.addedNodes[i].uid );
                appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.splice( index, 0, eventData.addedNodes[i].uid );
            }
            refreshDependenciesDisplayValues( eventData.dataProvider );
        }
    } ) );

    // Handle the nodes being removed
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesRemoved', eventData => {
        // TODO: FIX ME
        _.forEach( eventData.deletedUids, function( vmo ) {
            let index =  appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( vmo );
            appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.splice( index, 1 );
        } );
        refreshDependenciesDisplayValues( eventData.dataProvider );
    } ) );

    // Handle the dependencies being loaded
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesLoaded', eventData => {
        regenerateDependencyIds();
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    } ) );

    // Handle the dependencies being added
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesAdded', eventData => {
        processCreatedDependency( eventData.dependenciesInfo );
        refreshDependenciesDisplayValues( eventData.dataProvider );
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    } ) );

    // Handle the dependencies being removed
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesDeleted', eventData => {
        processDeletedDependency( eventData.dependenciesInfo );
        refreshDependenciesDisplayValues( eventData.dataProvider );
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    } ) );

    // Handle the reordering of tasks.
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.tasksReordered', eventData => {
        // add moved schedule objects and its children below its previous sibling
        let loadedVMObjects = eventData.dataProvider.viewModelCollection.loadedVMObjects;

        let treeNodeUids = [];
        for( let index = 0; index < loadedVMObjects.length; index++ ) {
            treeNodeUids.push( loadedVMObjects[index].uid );
        }
        appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids = treeNodeUids;
        refreshDependenciesDisplayValues( eventData.dataProvider );
    } ) );

    return eventSubscriptions;
};

export let loadRenderedColumnProperties = function( ) {
    let viewModel = viewModelService.getViewModelUsingElement( schNavTreeUtils.getScheduleNavigationTreeTableElement() );
    if( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.length === 0 ) {
        for( let index = 0; index <  viewModel.dataProviders.scheduleNavigationTreeDataProvider.viewModelCollection.loadedVMObjects.length; index++ ) {
            appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.push( viewModel.dataProviders.scheduleNavigationTreeDataProvider.viewModelCollection.loadedVMObjects[index].uid );
        }
        refreshDependenciesDisplayValues();
    }
};

/**
 * @param {TreeLoadInput} treeLoadInput - tree load input
 * @param {declViewModel} vmNodes - the declrative view model children nodes
 */
export let cacheTreeNodes = function( treeLoadInput, vmNodes ) {
    scheduleTaskProcessed = [];
    var cachedNodes = [];
    if( !treeLoadInput.isTopNode ) {
        cachedNodes = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids;
    }

    if( cachedNodes.indexOf( treeLoadInput.parentElementUid ) > -1 ) {
        let parentIndex = cachedNodes.indexOf( treeLoadInput.parentElementUid );
        let newIndex = parentIndex + treeLoadInput.startChildNdx;
        let parentNodeChildren = treeLoadInput.parentNode.children;
        //Add child count of previous siblings to get the correct number
        if( parentNodeChildren && Array.isArray( parentNodeChildren ) ) {
            parentNodeChildren.forEach( ( child ) => {
                if( child.children ) {
                    newIndex += child.children.length;
                }
            } );
        }
        let incrementIndex = 1;
        _.forEach( vmNodes, function( vmo ) {
            if( cachedNodes.indexOf( vmo.uid ) === -1 ) {
                cachedNodes.splice( newIndex + incrementIndex, 0, vmo.uid );
                incrementIndex++;
            }
        } );
    } else {
        cachedNodes.push( treeLoadInput.parentElementUid );
        _.forEach( vmNodes, function( vmo ) {
            if( cachedNodes.indexOf( vmo.uid ) === -1 ) {
                cachedNodes.push( vmo.uid );
            }
        } );
    }
    appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids = cachedNodes;
};

/** This function validates display string of dependency
 * @param {string} depStr - Dependency string to validate
 */
var validateChars = function( depStr ) {
    return /^[0-9,F,S,D,H,P,G,\-,+,.,,]+$/i.test( depStr );
};

/**  This function prepares the input for delete dependencies
 * @param {Array} depToRemove - Dependencies displayValues to remove
 * @param {List} depInfo - Dependencies uids to remove
 * @param {VMO} scheduleVMO - Schedule Object
 * @return {Structure} depDeleteInput - Input data to deleteDependecy
 */
var processDepDeletes = function( depToRemove, depInfo, scheduleVMO ) {
    var uidDepToDeleteVMO = [];
    var depDeleteInput = {};
    for( var inx = 0; inx < depToRemove.length; ++inx ) {
        //Get Uid from DBValue property.
        var existingDepUiValues = depInfo.displayValues;
        var indexOfDep = existingDepUiValues.indexOf( depToRemove[ inx ] );
        if( indexOfDep !== -1 && depToRemove[ inx ] !== '' ) {
            var depVMOToDelete = cdm.getObject( depInfo.dependencyUids[ indexOfDep ] );
            if( depVMOToDelete ) {
                uidDepToDeleteVMO.push( depVMOToDelete );
            }
        }
    }

    if( uidDepToDeleteVMO.length > 0 ) {
        depDeleteInput = {
            schedule: scheduleVMO,
            dependencyDeletes: uidDepToDeleteVMO
        };
    }
    return depDeleteInput;
};

/**  This function prepares the input for add dependencies
 * @param {Array} depToAdd - Dependencies displayValues to add
 * @param {string} propertyName - Property name
 * @param {Object} selectedTask - Schedule Task
 * @param {VMO} scheduleVMO - Schedule Object
 * @return {Structure} inputData - Input data to CreateDependecy
 */
var processDepAdds = function( depToAdd, propertyName, selectedTask, scheduleVMO ) {
    var dependencyInfo = [];
    var inputData = {};
    newDependenciesWithDisplayValues = [];
    for( var inx = 0; inx < depToAdd.length; ++inx ) {
        var typeString = '';
        var indexOfTaskStr = '';
        var stringWithTypeAndIndex = '';
        var lagTimeString = '';

        var depToAddString = depToAdd[ inx ];
        if( depToAddString === '' ) {
            continue;
        }

        //Remove white space
        var stringValue = depToAddString.replace( /\s/g, '' );

        // The expected format is TaskIndex[Type][+/-lag].
        // '5','3SS+3','7FS-2',and '4FF'are examples of valid entries.
        var hasPlusDelimeter = stringValue.includes( '+' );
        var hasMinusDelimeter = stringValue.includes( '-' );

        var stringValueArray = [];
        if( hasPlusDelimeter ) {
            stringValueArray = stringValue.split( '+' );
        } else if( hasMinusDelimeter ) {
            stringValueArray = stringValue.split( '-' );
        } else {
            stringValueArray.push( stringValue );
        }

        //If String doesn't have Delimeter, stringValueArray should have one entry.
        if( stringValueArray && stringValueArray.length === 1 ) {
            stringWithTypeAndIndex = stringValueArray[ 0 ].trim(); //remove white space in case
            if( !/^[\.0-9,F,S,P,G]+$/i.test( stringWithTypeAndIndex ) ) {
                throw '';
            }
        }

        //If String has Delimeter, stringValueArray should have two entry.
        if( stringValueArray && stringValueArray.length === 2 ) {
            stringWithTypeAndIndex = stringValueArray[ 0 ].trim(); //remove white space in case
            lagTimeString = stringValueArray[ 1 ].trim(); //remove white space in case
            if( !/^[\.0-9,d,h]+$/i.test( lagTimeString ) ) {
                throw '';
            }
            if( lagTimeString && lagTimeString.indexOf( 'd' ) === -1 && lagTimeString.indexOf( 'h' ) === -1 ) {
                lagTimeString = lagTimeString.concat( 'd' );
            }
        }

        //Find type of dependency from stringWithTypeAndIndex. If it's not present, default is "FS".
        var indexofType = -1;
        indexofType = stringWithTypeAndIndex.indexOf( 'FS' );
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'FF' );
        }
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'SF' );
        }
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'SS' );
        }
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'PG' );
        }

        // One of the Dep type is found
        if( indexofType !== -1 ) {
            typeString = stringWithTypeAndIndex.substring( indexofType, indexofType + 2 ); //Two Character from type char index is type of Dependency
            if( indexofType !== 0 ) {
                indexOfTaskStr = stringWithTypeAndIndex.substring( 0, indexofType ); // Start to type char index is Task Index.
            }
        } else { //If it's not present, default is "FS".
            typeString = 'FS';
            indexOfTaskStr = stringWithTypeAndIndex;
        }

        if( !indexOfTaskStr ) {
            throw '';
        }

        //process lagtime
        var inputLagime = processLagTime( lagTimeString, hasPlusDelimeter, hasMinusDelimeter );

        //Get task from view model for an index.
        let indexOfTaskInt = parseInt( indexOfTaskStr );
        var taskUidFromIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids[ indexOfTaskInt - 1 ];
        var taskFromIndex = cdm.getObject( taskUidFromIndex );
        if( !taskFromIndex ) {
            localeSvc.getLocalizedText( 'ScheduleManagerMessages', 'taskNotFoundError' ).then( function( result ) {
                var err = result.replace( '{0}', '\'' + indexOfTaskStr + '\'' );
                messagingService.showError( err );
            } );
        } else {
            // Prepare SOA input.
            var depType = getDependencyTypeFromString( typeString );

            var sourceVMO = '';
            var targetVMO = '';
            if( propertyName === 'saw1Successors' ) {
                sourceVMO = selectedTask;
                targetVMO = taskFromIndex;
            } else {
                sourceVMO = taskFromIndex;
                targetVMO = selectedTask;
            }

            var info = {
                predTask: sourceVMO,
                succTask: targetVMO,
                depType: depType,
                lagTime:inputLagime
            };
            let depInfo = {
                predTask: sourceVMO,
                succTask: targetVMO,
                depString: depToAdd[inx]
            };
            newDependenciesWithDisplayValues.push( depInfo );
            dependencyInfo.push( info );
        }
    }
    if( dependencyInfo.length > 0 ) {
        inputData = {
            schedule: scheduleVMO,
            newDependencies: dependencyInfo
        };
    }
    return inputData;
};

var processLagTime = function( lagTimeString, hasPlusDelimeter, hasMinusDelimeter ) {
    var inputLagime = 0;
    if( lagTimeString !== '' && ( hasPlusDelimeter || hasMinusDelimeter ) ) {
        var hasHour = false;
        var hasDay = false;
        var indexOfTimeUnit = 0;
        var indexOfDayUnit = 0;
        indexOfTimeUnit = lagTimeString.indexOf( 'h' );
        indexOfDayUnit = lagTimeString.indexOf( 'd' );
        if( indexOfTimeUnit !== -1 ) {
            hasHour = true;
        }
        if( indexOfDayUnit !== -1 ) {
            hasDay = true;
        }

        //If both are false, default is "d"
        if( !hasDay && !hasHour ) {
            hasDay = true;
        }

        var dayStartIndex = 0;
        var timeStartIndex = 0;
        if( hasDay && indexOfDayUnit > indexOfTimeUnit ) {
            dayStartIndex = indexOfTimeUnit + 1;
        } else if ( indexOfTimeUnit > indexOfDayUnit ) {
            timeStartIndex = indexOfDayUnit + 1;
        }

        var timeString = '';
        var timeInt = 0;
        if( indexOfTimeUnit !== -1 && hasHour ) {
            timeString = lagTimeString.substring( timeStartIndex, indexOfTimeUnit );
            if( !isNaN( timeString ) ) {
                timeInt = parseInt( timeString );
                timeInt *= 60;
                if( timeInt > 0 ) {
                    if( hasMinusDelimeter ) {
                        inputLagime -= timeInt;
                    } else {
                        inputLagime += timeInt;
                    }
                }
            }
        }

        var dayString = '';
        var dayInt = 0;
        if( indexOfDayUnit !== -1 && hasDay ) {
            dayString = lagTimeString.substring( dayStartIndex, indexOfDayUnit );
            if( !isNaN( dayString ) ) {
                dayInt = parseInt( dayString );
                dayInt *= 480;
                if( dayInt > 0 ) {
                    if( hasMinusDelimeter ) {
                        inputLagime -= dayInt;
                    } else {
                        inputLagime += dayInt;
                    }
                }
            }
        }
    }
    return inputLagime;
};

/**  This function return dependency type from string passed
 * @param {string} typeString - Dependecy type in string
 * @return {Int} typeInt - Dependency Type
 */
var getDependencyTypeFromString = function( typeString ) {
    var typeInt = smConstants.DEPENDENCY_TYPE[ typeString ];
    if( typeInt === undefined ) {
        typeInt = -1;
    }
    return typeInt;
};

/**  This function returns the display value of predecessor and successor columns for given task
 * @param {Object} depProp - Dependency Info
 * @param {Uid} taskUid - Task Uid
*/
let getNewDependenciesDisplayValue = function( depProp, taskUid, isProxyDep ) {
    let newDepDisplayValue = '';
    for( let index = 0; newDependenciesWithDisplayValues.length > index; index++ ) {
        let taskDependency = newDependenciesWithDisplayValues[index];
        if( taskDependency.succTask.uid === depProp.primary_object && taskDependency.predTask.uid === depProp.secondary_object || isProxyDep ) {
            let depString = taskDependency.depString;
            var hasPlusDelimeter = depString.includes( '+' );
            var hasMinusDelimeter = depString.includes( '-' );
            var stringValueArray = [];
            let regxStr = [];
            if( hasPlusDelimeter ) {
                stringValueArray = depString.split( '+' );
                regxStr = stringValueArray[0].match( /[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g );
            } else if( hasMinusDelimeter ) {
                stringValueArray = depString.split( '-' );
                regxStr = stringValueArray[0].match( /[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g );
            } else {
                regxStr = depString.match( /[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g );
            }

            if( stringValueArray && stringValueArray.length === 2 ) {
                let newDepDisplayNumber = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                if( hasPlusDelimeter ) {
                    newDepDisplayValue = newDepDisplayNumber.toString() + regxStr[1] + '+' + stringValueArray[1];
                } else if( hasMinusDelimeter ) {
                    newDepDisplayValue = newDepDisplayNumber.toString() + regxStr[1] + '-' + stringValueArray[1];
                }
            } else if( stringValueArray && stringValueArray.length === 1 ||  regxStr && regxStr.length === 2 ) {
                let newDepDisplayNumber = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                newDepDisplayValue = newDepDisplayNumber.toString() + regxStr[1];
            }else{
                let newDepDisplayNumber = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                newDepDisplayValue = newDepDisplayNumber.toString();
            }
            return newDepDisplayValue;
        }
    }
    return newDepDisplayValue;
};

/**  This function perform add and delete dependency based on inline editing in schedule Tree table
 * @param {VMO} scheduleTaskVMO - schedule task Object
 * @param {string} propertyName - Property name saw1Predecessor/saw1Successor
 * @param {string} stringOldValue - Old value of property edited
 * @param {string} stringNewValue - New value of property
 */
export let saveDependencyEdits = function( scheduleTaskVMO, propertyName, stringOldValue, stringNewValue ) {
    var defer = AwPromiseService.instance.defer( );
    try {
        let index = -1;
        _.forEach( scheduleTaskProcessed, function( dependency ) {
            if( dependency.taskUid === scheduleTaskVMO.id && dependency.displayValues === stringNewValue ) {
                index = 0;
            }
        } );
        if( index === -1 ) {
            //Get DB value property which has Dependency Uid information.

            let taskProcessed = {
                taskUid: scheduleTaskVMO.id,
                displayValues: stringNewValue
            };
            scheduleTaskProcessed.push( taskProcessed );
            var depInfo = {};
            var stringNewValue = '';
            if( propertyName === 'saw1Successors' ) {
                depInfo = schNavigationDepCacheService.getTaskSuccDependencies( scheduleTaskVMO.uid );
                stringNewValue = scheduleTaskVMO.props.saw1Successors.dbValue;
            }

            if( propertyName === 'saw1Predecessors' ) {
                depInfo = schNavigationDepCacheService.getTaskPredDependencies( scheduleTaskVMO.uid );
                stringNewValue = scheduleTaskVMO.props.saw1Predecessors.dbValue;
            }
            var depToRemove = [];
            let stringNewValueArray = [];
            //Assume all New values are newly added dependencies and old values are removed dependencies.
            if( stringNewValue ) {
                stringNewValueArray = stringNewValue.trim().split( ',' );
                //If Removed dependency is also present in New property values, means it's not removed. Remove from array
                for( var j = 0; j < stringNewValueArray.length; ++j ) {
                    depToRemove = depToRemove.filter( function( dep ) {
                        return dep !== stringNewValueArray[ j ];
                    } );
                }
            }
            var depToAdd = [];
            var stringOldValueArray = [];
            if( stringOldValue ) {
                stringOldValueArray = stringOldValue.trim().split( ',' );
                //If Added dependency is also present in old property values, means it's not newly added. Remove from array
                for( var i = 0; i < stringOldValueArray.length; ++i ) {
                    depToAdd = depToAdd.filter( function( dep ) {
                        return dep !== stringOldValueArray[ i ];
                    } );
                }
            }

            if( stringNewValue ) {
                var validStr = validateChars( stringNewValue );
                if( !validStr ) {
                    throw '';
                }
                depToAdd = stringNewValueArray;
            }

            if( stringOldValue ) {
                depToRemove = stringOldValueArray;
            }

            var scheduleVMO = appCtxSvc.getCtx( 'pselected' );
            //Process Dependency Delete
            var depDeleteInput = processDepDeletes( depToRemove, depInfo, scheduleVMO );

            //Process Dependency Add
            var depAddInput = processDepAdds( depToAdd, propertyName, scheduleTaskVMO, scheduleVMO );

            if( depDeleteInput.dependencyDeletes && depAddInput.newDependencies ) {
                //Execute Dependency Delete and Add
                let depAddDeleteData = {
                    depDeleteInput : depDeleteInput,
                    depAddInput : depAddInput
                };
                eventBus.publish( 'InlineDependencyDelete', depAddDeleteData );
                eventBus.subscribe( 'InlineDependencyDeleteSuccess', function() {
                    defer.resolve();
                } );
            } else if( depDeleteInput.dependencyDeletes && !depAddInput.newDependencies ) {
                //Execute Dependency Delete
                let depAddDeleteData = {
                    depDeleteInput : depDeleteInput
                };
                eventBus.publish( 'InlineDependencyDelete', depAddDeleteData );
                eventBus.subscribe( 'InlineDependencyDeleteSuccess', function() {
                    defer.resolve();
                } );
            } else if( depAddInput.newDependencies && !depDeleteInput.dependencyDeletes ) {
                //Execute Dependency Add
                eventBus.publish( 'InlineDependencyCreate', depAddInput );
                eventBus.subscribe( 'InlineDependencyCreateSuccess', function() {
                    defer.resolve();
                } );
            }
            return depToAdd;
        }
    } catch( error ) {
        let msg = 'inlineDepFormatPredError';
        if( propertyName === 'saw1Successors' ) {
            msg = 'inlineDepFormatSuccError';
        }
        localeSvc.getLocalizedText( 'ScheduleManagerMessages', msg ).then( function( result ) {
            var err = result.replace( '{0}', '\'' + stringNewValue + '\'' );
            messagingService.showError( err );
        } );
    }
};
let processCrossScheduleDependency = function( primaryUid, secondaryUid ) {
    let primaryVMO = cdm.getObject( primaryUid );
    let secondaryVMO = cdm.getObject( secondaryUid );
    let isProxyDep = false;
    if( cmm.isInstanceOf( 'Fnd0ProxyTask', primaryVMO.modelType ) && primaryVMO.props.fnd0task_tag ) {
        var homeTaskPropPrimary = primaryVMO.props.fnd0task_tag.dbValues[ 0 ];
        if( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( homeTaskPropPrimary ) !== -1 ) {
            primaryUid = homeTaskPropPrimary;
            isProxyDep = true;
        }
    }
    if( cmm.isInstanceOf( 'Fnd0ProxyTask', secondaryVMO.modelType )  && secondaryVMO.props.fnd0task_tag ) {
        var homeTaskPropSecondary = secondaryVMO.props.fnd0task_tag.dbValues[ 0 ];
        if( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( homeTaskPropSecondary ) !== -1 ) {
            secondaryUid = homeTaskPropSecondary;
            isProxyDep = true;
        }
    }
    return {
        primaryUid: primaryUid,
        secondaryUid: secondaryUid,
        isProxyDep: isProxyDep
    };
};

/**  This function process newly created dependencies.
 * @param {Array} createdDependencyInfos - Created Dependencies array
*/
let processCreatedDependency = function( createdDependencyInfos ) {
    _.forEach( createdDependencyInfos, function( obj ) {
        var depProp = cdm.getObject( obj.uid );
        let primaryUid = depProp.props.primary_object.dbValues[0];
        let secondaryUid = depProp.props.secondary_object.dbValues[0];

        let linkInfo = processCrossScheduleDependency( primaryUid, secondaryUid );

        let dependency = {
            primary_object : linkInfo.primaryUid,
            secondary_object : linkInfo.secondaryUid
        };
        // Update Predecessor Dependencies Map for newly created Dep
        let newDepDisplayValue = '';
        newDepDisplayValue = getNewDependenciesDisplayValue( dependency, dependency.primary_object, linkInfo.isProxyDep );

        if( newDepDisplayValue === '' ) {
            newDepDisplayValue = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( depProp.props.primary_object.dbValues[0] ) + 1;
        }
        let succDependency = schNavigationDepCacheService.getTaskSuccDependencies( depProp.props.secondary_object.dbValues[0] );

        let deps = [];
        if( succDependency && succDependency.dependencyUids && succDependency.dependencyUids.length > 0 ) {
            deps = succDependency.dependencyUids;
        }
        if( succDependency && succDependency.displayValues && succDependency.displayValues.indexOf( newDepDisplayValue.toString() ) === -1 ) {
            succDependency.displayValues.push( newDepDisplayValue );
        }
        if( deps.indexOf( obj.uid ) === -1 ) {
            deps.push( obj.uid );
        }
        if( succDependency.displayValues ) {
            schNavigationDepCacheService.addToTaskSuccDependencyMap( dependency.secondary_object, deps, succDependency.displayValues );
        } else {
            let succDisplayValue = [];
            succDisplayValue.push( newDepDisplayValue.toString() );
            schNavigationDepCacheService.addToTaskSuccDependencyMap( dependency.secondary_object, deps,  succDisplayValue );
        }

        newDepDisplayValue = '';
        // Update Successor Dependencies Map for newly created Dep
        newDepDisplayValue = getNewDependenciesDisplayValue( dependency, dependency.secondary_object, linkInfo.isProxyDep );
        if( newDepDisplayValue === '' ) {
            newDepDisplayValue = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( dependency.secondary_object ) + 1;
        }
        deps = [];
        let predDependency = schNavigationDepCacheService.getTaskPredDependencies( dependency.primary_object, linkInfo.isProxyDep );
        if( predDependency && predDependency.dependencyUids && predDependency.dependencyUids.length > 0 ) {
            deps = predDependency.dependencyUids;
        }
        if( deps.indexOf( obj.uid ) === -1 ) {
            deps.push( obj.uid );
        }
        if( predDependency && predDependency.displayValues && predDependency.displayValues.indexOf( newDepDisplayValue.toString() ) === -1 ) {
            predDependency.displayValues.push( newDepDisplayValue.toString() );
        }
        if( predDependency.displayValues ) {
            schNavigationDepCacheService.addToTaskPredDependencyMap( dependency.primary_object, deps, predDependency.displayValues );
        } else {
            let predDisplayValue = [];
            predDisplayValue.push( newDepDisplayValue.toString() );
            schNavigationDepCacheService.addToTaskPredDependencyMap( dependency.primary_object, deps, predDisplayValue );
        }
    } );
    newDependenciesWithDisplayValues = [];
};

/**  This function process deleted dependencies.
 * @param {Array} delDependencyInfos - deleted Dependencies array
*/
let processDeletedDependency = function( delDependencyInfos ) {
    for( let index = 0; index < delDependencyInfos.length; index++ ) {
        let predUid = delDependencyInfos[index].primaryUid;
        let succUid = delDependencyInfos[index].secondaryUid;

        // Update Predecessor Dependencies Map for newly created Dep
        let newPredDisplayValue = [];
        let predDependency = schNavigationDepCacheService.getTaskPredDependencies( predUid );
        let deps = predDependency.dependencyUids;
        let deletedDeps = [];
        if( deps ) {
            for( let index = 0; index < deps.length; index++ ) {
                let depObj = getDependencyObject( deps[index] );
                if( depObj !== undefined ) {
                    let succRowID = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( depObj.secondaryUid ) + 1;
                    newPredDisplayValue.push( succRowID.toString() );
                    deletedDeps.push( deps[index] );
                }
            }
            schNavigationDepCacheService.addToTaskPredDependencyMap( predUid, deletedDeps, newPredDisplayValue );
        }


        // Update Successor Dependencies Map for newly created Dep
        let newSuccDisplayValue = [];
        let succDependency = schNavigationDepCacheService.getTaskSuccDependencies( succUid );
        deps = succDependency.dependencyUids;
        deletedDeps = [];
        if( deps ) {
            for( let index = 0; index < deps.length; index++ ) {
                let depObj = getDependencyObject( deps[index] );
                if( depObj !== undefined ) {
                    let succRowID = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( depObj.primaryUid ) + 1;
                    newSuccDisplayValue.push( succRowID.toString() );
                    deletedDeps.push( deps[index] );
                }
            }
            schNavigationDepCacheService.addToTaskSuccDependencyMap( succUid, deletedDeps, newSuccDisplayValue );
        }
    }
};

/**  This function returns dependency VMO from dependency uid.
 * @param {string} dependency - Dependency Uid
 * @returns {VMO} dependenciesInfo[index] - Dependency VMO
*/
let getDependencyObject = function( dependency ) {
    let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
    for( let index = 0; index < dependenciesInfo.length; index++ ) {
        if( dependenciesInfo[index].uid === dependency ) {
            return dependenciesInfo[index];
        }
    }
};

/**  This function updated loaded VMO object of scheduleNavigationTreeDataProvider
 * @param {data} data - Data
 * @param {eventData} eventData - Event Data contain updated objects
*/
export let updateViewModel = function( data, eventData ) {
    _.forEach( eventData, function( value, key ) {
        let index = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( key );
        if( index !== -1 ) {
            if( value.indexOf( 'saw1Predecessors' ) > -1 && appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap ) {
                let taskUidToPredDependencyMap = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap;
                let predDeps = taskUidToPredDependencyMap[key];
                if( predDeps ) {
                    setDependencyDisplayValue( data.dataProviders.scheduleNavigationTreeDataProvider, index, predDeps, 'saw1Predecessors' );
                }
            }
            if( value.indexOf( 'saw1Successors' ) > -1 && appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap ) {
                let taskUidToSuccDependencyMap = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap;
                let succDeps = taskUidToSuccDependencyMap[key];
                if( succDeps ) {
                    setDependencyDisplayValue( data.dataProviders.scheduleNavigationTreeDataProvider, index, succDeps, 'saw1Successors' );
                }
            }
        }
    } );
};

/**  This function updated loaded VMO object display value of dependency of scheduleNavigationTreeDataProvider
 * @param {data} data - Data
 * @param {index} index - VMO index
 * @param {VMO} taskDep - Dependency VMO
 * @param {string} dependency - Property Predecessor/Successor
*/
let setDependencyDisplayValue = function( dataProvider, index, taskDep, dependency ) {
    let props = dataProvider.viewModelCollection.loadedVMObjects[index].props;
    if( props && props[ dependency ] ) {
        let taskDepDispValue = '';
        if( taskDep !== undefined && taskDep.displayValues && taskDep.displayValues.length !== 0 ) {
            for( var i = 0; i < taskDep.displayValues.length; ++i ) {
                taskDepDispValue += taskDep.displayValues[ i ];
                if( i !== taskDep.displayValues.length - 1 ) {
                    taskDepDispValue += ',';
                }
            }
        }
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].dbValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].displayValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].prevDisplayValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].uiValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].dbValue = taskDepDispValue;
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].uiValue = taskDepDispValue;
    }
};


/**
 * This will fetch the Task Data.
 */
export let regenerateDependencyIds = function() {
    let depInfos = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
    var processedDependencies = []; //TO avoid duplicate
    schNavigationDepCacheService.registerMaps();
    var taskToPredMap = {};
    var taskToSuccMap = {};
    depInfos.forEach( function( depInfo ) {
        var depUid = depInfo.uid;
        var succTask = depInfo.secondaryUid;
        var predTask = depInfo.primaryUid;

        let linkInfo = processCrossScheduleDependency( predTask, succTask );

        let dependency = {
            primary_object : linkInfo.primaryUid,
            secondary_object : linkInfo.secondaryUid
        };

        if( processedDependencies.indexOf( depUid ) < 0 ) {
            processedDependencies.push( depUid );
            if( !taskToPredMap[ dependency.primary_object ] ) {
                taskToPredMap[ dependency.primary_object ] = [];
            }

            if( !taskToSuccMap[ dependency.secondary_object ] ) {
                taskToSuccMap[ dependency.secondary_object ] = [];
            }

            taskToPredMap[ dependency.primary_object ].push( depUid );
            taskToSuccMap[ dependency.secondary_object ].push( depUid );
        }
    } );

    for( let taskUid in taskToPredMap ) {
        var predDisplayValues = [];
        var predDbValues = [];
        var predDep = taskToPredMap[ taskUid ];
        getDependencyMapValues( predDep, predDbValues, predDisplayValues, false );
        if( predDbValues.length > 0 ) {
            schNavigationDepCacheService.addToTaskPredDependencyMap( taskUid, predDbValues, predDisplayValues );
        }
    }

    for( let taskUid in taskToSuccMap ) {
        var succDisplayValues = [];
        var succDbValues = [];
        var succDep = taskToSuccMap[ taskUid ];
        getDependencyMapValues( succDep, succDbValues, succDisplayValues, true );
        if( succDbValues.length > 0 ) {
            schNavigationDepCacheService.addToTaskSuccDependencyMap( taskUid, succDbValues, succDisplayValues );
        }
    }
};


var getDependencyMapValues = function( deps, dbValues, displayValues, isSuccDep ) {
    if( deps ) {
        deps.forEach( function( depUid ) {
            var depVMO = cdm.getObject( depUid );
            if( depVMO && depVMO.props.dependency_type ) {
                var depTypeString = getDependencyType( depVMO.props.dependency_type.dbValues[ 0 ] );
                var depLagString = '';
                var depLagInt = parseInt( depVMO.props.lag_time.dbValues[ 0 ] );
                if( depLagInt !== 0 ) {
                    var operator = '+';
                    depLagInt = depLagInt / 8 / 60;
                    if( depLagInt < 0 ) {
                        operator = '';
                    }
                    depLagString = operator + depLagInt + 'd';
                } else if( depTypeString === 'FS' ) {
                    depTypeString = '';
                }
                var taskUid = -1;
                if( isSuccDep ) {
                    taskUid = depVMO.props.primary_object.dbValues[ 0 ];
                } else {
                    taskUid = depVMO.props.secondary_object.dbValues[ 0 ];
                }

                var taskIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                if( taskIndex ) {
                    var displayValue = taskIndex + depTypeString + depLagString;
                    if( displayValues.indexOf( displayValue ) < 0 ) {
                        displayValues.push( displayValue );
                        dbValues.push( depUid );
                    }
                }
            }
        } );
        if( displayValues && displayValues.length > 1 ) {
            displayValues.sort( function( a, b ) { return a - b; } );
        }
    }
};

export let getDependencyType = function( typeInt ) {
    var typeString = smConstants.DEPENDENCY_TYPE_INT[ typeInt ];
    if( typeString ) {
        return typeString;
    }
    return '';
};


/**  This function refesh dependencies display value based on create/delete operation
 * @param {data} data - Data
*/
export let refreshDependenciesDisplayValues = function( dataProvider ) {
    regenerateDependencyIds();
    //let viewModel = viewModelService.getViewModelUsingElement( schNavTreeUtils.getScheduleNavigationTreeTableElement() );
    updateDependencyValues( dataProvider );
};
/**  This function sets value of saw1Predecessor and saw1Successor properties of loaded VMO object of scheduleNavigationTreeDataProvider by getting values
 * from dependencyNumbersCache maps
 * @param {data} data - Data
*/
export let updateDependencyValues = function( dataProvider ) {
    if( dataProvider ) {
        let loadedVMO = dataProvider.viewModelCollection.loadedVMObjects;
        for( let index = 0; index < loadedVMO.length; index++ ) {
            let predValue;
            if( appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache &&
                appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap ) {
                predValue = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap[ loadedVMO[index].uid ];
                if( predValue ) {
                    setDependencyDisplayValue( dataProvider, index, predValue, 'saw1Predecessors' );
                }
            }
            let succValue;
            if( appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache &&
                appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap ) {
                succValue = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap[ loadedVMO[index].uid ];
                if( succValue ) {
                    setDependencyDisplayValue( dataProvider, index, succValue, 'saw1Successors' );
                }
            }
        }
    }
    scheduleTaskProcessed = [];
};

export default exports = {
    subscribeEvents,
    cacheTreeNodes,
    saveDependencyEdits,
    refreshDependenciesDisplayValues,
    regenerateDependencyIds,
    updateViewModel,
    updateDependencyValues,
    loadRenderedColumnProperties
};
