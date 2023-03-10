// Copyright (c) 2022 Siemens

/**
 * @module js/AddProjectPanel
 */
import commandPanelService from 'js/commandPanel.service';
import selectionService from 'js/selection.service';
import appCtxService from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

export let getAddProjectPanel = function( commandId, location, ctx ) {
    var programPlanningContext = 'programPlanningContext';
    var selection = selectionService.getSelection().selected;

    if( selection && selection.length > 0 || ctx.pselected !== undefined ) {
        var allowedChildTypes = selection[ 0 ].props.prg0AllowedChildTypes.dbValues[ 0 ];
        var indexOfTypeSeparator = allowedChildTypes.indexOf( ',' );
        var planObjType = '';
        if( indexOfTypeSeparator < 0 ) {
            var modelType = cmm.getType( allowedChildTypes );
            if( modelType !== null ) {
                planObjType = modelType.displayName;
            }
        }

        var allowedChildTypesArray = allowedChildTypes.split( ',' );

        var promise = soaService.ensureModelTypesLoaded( allowedChildTypesArray );

        if( promise ) {
            promise.then( function() {
                var parentType = 'Prg0AbsProjectPlan';
                var allowedTypes = [];

                for( var i = 0; i < allowedChildTypesArray.length; i++ ) {
                    var type = cmm.getType( allowedChildTypesArray[ i ] );
                    if( type !== undefined && cmm.isInstanceOf( parentType, type ) ) {
                        allowedTypes.push( allowedChildTypesArray[ i ] );
                    }
                }
                if( ctx.mselected[ 0 ].props.object_type.dbValues[ 0 ] === 'Prg0AbsProgramPlan' ) {
                    allowedTypes.push( 'Prg0ProjectPlan' );
                }
                var showTypes = false;
                var typesToCreate = '';
                if( allowedTypes.length > 1 ) {
                    for( var index = 0; index < allowedTypes.length; index++ ) {
                        typesToCreate += allowedTypes[ index ];
                        typesToCreate += ',';
                    }
                    showTypes = true;
                } else {
                    typesToCreate += allowedTypes[ 0 ];
                }

                var prgPlanningContextObject;
                if( commandId === 'Pgp0AddPlanLevel' ) {
                    prgPlanningContextObject = {
                        TypeTitle: planObjType,
                        PanelTitle: 'Add Plan Level',
                        locationObject: ctx.pselected,
                        type1: typesToCreate,
                        parent: ctx.mselected[ 0 ],
                        showTypes: showTypes,
                        parentName: 'Prg0AbsPlan'
                    };
                }
                appCtxService.registerCtx( programPlanningContext, prgPlanningContextObject );
                commandPanelService.activateCommandPanel( 'Pgp0AddPlanLevel', location, null, true, null, {
                    isPinUnpinEnabled: true
                } );
            } );
        } else {
            appCtxService.unRegisterCtx( programPlanningContext );
        }
    }
};

export let getAddCriteria = function( commandId, location, ctx ) {
    var programPlanningContext = 'programPlanningContext';
    var selection = selectionService.getSelection().selected;
    var selectedUid = ctx.mselected[0];
    if( selection && selection.length > 0 || ctx.locationContext.modelObject !== undefined ) {
        var prgPlanningContextObject = {
            TypeTitle: 'Criterion',
            PanelTitle: 'Add Criterion',
            locationObject: ctx.locationContext.modelObject,
            type1: 'Prg0AbsCriteria',
            parent: selectedUid,
            showTypes: false,
            parentName: 'Prg0AbsCriteria'
        };

        appCtxService.registerCtx( programPlanningContext, prgPlanningContextObject );
        commandPanelService.activateCommandPanel( 'Pgp0AddCriteria', location, null, null, null, {
            isPinUnpinEnabled: true
        } );
    }
};

export let getAddResponsibleUser = function( commandId, location, ctx ) {
    var programPlanningContext = 'programPlanningContext';
    var selection = selectionService.getSelection().selected;

    if( selection && selection.length > 0 || ctx.locationContext.modelObject !== undefined ) {
        var prgPlanningContextObject = {
            TypeTitle: 'Add Responsible User',
            PanelTitle: 'Add Responsible User',
            locationObject: ctx.locationContext.modelObject,
            type1: 'User,Group,Role,POM_member,GroupMember,Person',
            parent: ctx.mselected[ 0 ],
            showTypes: false,
            parentName: 'User'
        };

        appCtxService.registerCtx( programPlanningContext, prgPlanningContextObject );
        commandPanelService.activateCommandPanel( 'Pgp0AddResponsibleUser', location );
    }
};

export default exports = {
    getAddProjectPanel,
    getAddCriteria,
    getAddResponsibleUser
};
