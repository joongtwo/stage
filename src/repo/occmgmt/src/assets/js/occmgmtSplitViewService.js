import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';
import occMgmtServiceManager from 'js/occurrenceManagementServiceManager';
import dataManagementService from 'soa/dataManagementService';
import clientDataModel from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import aceSwaService from 'js/aceSwaService';
import _ from 'lodash';
import Debug from 'debug';
const trace = new Debug( 'selection' );

export const initializeOccmgmtSplitView = ( viewKeys, hiddenCommands ) => {
    appCtxService.registerCtx( 'aceActiveContext', { key: '', context: '' } );
    appCtxService.registerCtx( 'splitView', { mode: true, viewKeys: viewKeys } );
    appCtxService.registerCtx( 'decoratorToggle', false );
    appCtxService.updatePartialCtx( 'hiddenCommands', hiddenCommands );
    appCtxService.registerCtx( 'locationContext', {
        'ActiveWorkspace:Location': 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation',
        'ActiveWorkspace:SubLocation': 'showObject'
    } );
    if( !_.isUndefined( appCtxService.getCtx( 'refreshViewOnNotificationClick' ) ) ) {
        appCtxService.unRegisterCtx( 'refreshViewOnNotificationClick' );
    }
};

export const resetTreeExpansionState = () => {
    if( appCtxService.ctx.resetTreeExpansionState ) {
        var expansionState = {};
        appCtxService.ctx.splitView.viewKeys.map( function( view ) {
            expansionState[ view ] = true;
        } );
        appCtxService.ctx.splitView.resetTreeExpansionState = expansionState;
        delete appCtxService.ctx.resetTreeExpansionState;
    }
};

export const synchronizeSplitViewStateWithURL = ( objectsToOpen = [], activeState = [], occContext, occContext2, data ) => {
    //Get which parameters have changed
    let changedParams = {};
    let newOccContext;
    let newOccContext2;

    for( var i in AwStateService.instance.params ) {
        if( AwStateService.instance.params[ i ] !== activeState[ i ] ) {
            changedParams[ i ] = AwStateService.instance.params[ i ];
        }
    }

    //If the uid is changed refresh the whole page
    if( changedParams.hasOwnProperty( 'uid' ) ) {
        objectsToOpen[ 0 ] = objectsToOpen[ 0 ] || {};
        if( changedParams.uid ) {
            objectsToOpen[ 0 ].uid = AwStateService.instance.params.uid;
            newOccContext = data.declViewModelJson.data.occContext.initialValues;
        } else {
            delete objectsToOpen[ 0 ].uid;
        }
    }

    if( changedParams.hasOwnProperty( 'uid2' ) ) {
        objectsToOpen[ 1 ] = objectsToOpen[ 1 ] || {};
        if( changedParams.uid2 ) {
            objectsToOpen[ 1 ].uid = AwStateService.instance.params.uid2;
            newOccContext2 = data.declViewModelJson.data.occContext2.initialValues;
        } else {
            delete objectsToOpen[ 1 ].uid;
        }
    }

    // When entering the split view, the expanded nodes will be same for both the views.
    if( appCtxService.ctx.expandedNodes ) {
        let expNodesStableIds = appCtxService.ctx.expandedNodes.map( ( { stableId } ) => stableId );
        newOccContext.transientRequestPref.expandedNodes = expNodesStableIds;
        newOccContext2.transientRequestPref.expandedNodes = expNodesStableIds;
    }

    if( !_.isUndefined( newOccContext ) ) {
        occContext.update( newOccContext );
    }
    if( !_.isUndefined( newOccContext2 ) ) {
        occContext2.update( newOccContext2 );
    }
    return dataManagementService.loadObjects( [ objectsToOpen[ 0 ].uid, objectsToOpen[ 1 ].uid ] ).then( function() {
        var vmos = [
            viewModelObjectSvc.constructViewModelObjectFromModelObject( clientDataModel.getObject( objectsToOpen[ 0 ].uid ), null ),
            viewModelObjectSvc.constructViewModelObjectFromModelObject( clientDataModel.getObject( objectsToOpen[ 1 ].uid ), null )
        ];
        return {
            activeState: JSON.parse( JSON.stringify( AwStateService.instance.params ) ),
            objectsToOpen: vmos
        };
    } );
};

export const navigateToSplitView = ( occContext ) => {
    let currentState = occContext.currentState;
    let spageId = _.isEqual( aceSwaService.isTabSupportedForSplitView( currentState.spageId ), true ) ? currentState.spageId : null;
    let paramsToNavigate = {
        uid: currentState.uid,
        uid2: currentState.uid,
        c_uid: currentState.c_uid,
        c_uid2: currentState.c_uid,
        pci_uid: currentState.pci_uid,
        pci_uid2: currentState.pci_uid,
        o_uid: currentState.o_uid,
        o_uid2: currentState.o_uid,
        t_uid: currentState.t_uid,
        t_uid2: currentState.t_uid,
        spageId: spageId,
        spageId2: spageId
    };
    let transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
    AwStateService.instance.go( transitionTo, paramsToNavigate );
};

export const destroyOccmgmtSplitView = ( viewKeys ) => {
    let subPanelContext = {
        provider: {
            contextKey: viewKeys[ 0 ],
            useAutoBookmark: false
        }
    };
    occMgmtServiceManager.destroyOccMgmtServices( subPanelContext );
    subPanelContext.provider.contextKey = viewKeys[ 1 ];
    occMgmtServiceManager.destroyOccMgmtServices( subPanelContext );
    appCtxService.unRegisterCtx( 'aceActiveContext' );
    appCtxService.unRegisterCtx( 'hiddenCommands' );
    appCtxService.unRegisterCtx( 'splitView' );
    appCtxService.unRegisterCtx( 'locationContext' );
    if( appCtxService.getCtx( 'compareContext' ) ) {
        appCtxService.unRegisterCtx( 'compareList' );
        appCtxService.unRegisterCtx( 'cellClass' );
        if( !appCtxService.getCtx( 'refreshViewOnNotificationClick' ) ) {
            appCtxService.unRegisterCtx( 'compareContext' );
        }
    }
};

export const handleSelectionChange = ( localSelectionData, pageContext, selectionInfos = [] ) => {
    if( !_.isEmpty( localSelectionData ) ) {
        let activeComponent = localSelectionData.activeComponent;
        if( localSelectionData.selected && localSelectionData.selected.length > 0 ) {
            const activeCompIndex = selectionInfos.findIndex( entry => { return entry.activeComponent === localSelectionData.activeComponent; } );
            if( activeCompIndex !== -1 ) {
                if( localSelectionData.source === 'base' ) {
                    selectionInfos[ activeCompIndex ].activeSelections = [];
                }
                selectionInfos[ activeCompIndex ].activeSelections = localSelectionData.selected;
            } else {
                selectionInfos.push( {
                    activeComponent: localSelectionData.activeComponent,
                    activeSelections: localSelectionData.selected
                } );
            }
        }
        /* When you have two selections in PWA and you deselect the active selection; the selection goes back to baseSelection
         for that view. The below code will activate the inactive selection and turn it blue. The ace acitavte window event should
         also be fired to keep things in sync. OR the event should be completley removed. Commenting this code out as this will be
         Ux behavior change
        if( localSelectionData.source === 'base' ) {
            const inactiveCompIndex = selectionInfos.findIndex( entry => { return entry.activeComponent !== localSelectionData.activeComponent; } );
             if( inactiveCompIndex !== -1 ) {
                 activeComponent = selectionInfos[ inactiveCompIndex ].activeComponent;
             }
         } */
        if( _.get( pageContext, 'primarySublocTabState.value.activeComponent' ) !== activeComponent ) {
            pageContext.primarySublocTabState.update( { ...pageContext.primarySublocTabState, activeComponent } );
        }
        trace( 'OccmgmtSplit selectionData: ', localSelectionData );
    }
    return selectionInfos;
};

export const updatePageContext = ( localSelectionData, pageContext, keyOfActivatedView ) => {
    let appCtx = appCtxService.getCtx();
    if( appCtx.aceActiveContext.key !== keyOfActivatedView ) {
        if( _.get( pageContext, 'primarySublocTabState.value.activeComponent' ) && !_.isEmpty( localSelectionData ) ) {
            const activeComponent = localSelectionData.activeComponent;
            pageContext.primarySublocTabState.update( { ...pageContext.primarySublocTabState, activeComponent } );
        }
    }
};
