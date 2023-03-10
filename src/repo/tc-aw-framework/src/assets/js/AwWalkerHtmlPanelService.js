// Copyright (c) 2021 Siemens
import AwInclude from 'viewmodel/AwIncludeViewModel';
import AwFrame from 'viewmodel/AwFrameViewModel';
import xrtHtmlPanelSvc from 'js/xrtHtmlPanelService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import dataSourceService from 'js/dataSourceService';
import _ from 'lodash';

const addContainerResizeCSS = function( enableResizeCallback, enableresize ) {
    if( enableresize && enableResizeCallback ) {
        enableResizeCallback( true );
    }
};

const cleanUpResizeCSS = function( enableResizeCallback, enableresize ) {
    if( enableresize && enableResizeCallback ) {
        enableResizeCallback( false );
    }
};

/**
 * @param {ViewModelObject} parentVMO - VMO to access
 * @param {String} propName - Name of the property to on parent to access for results.
 *
 * @return {HtmlPanelModelObject} New object representing the CDM modelObject at the given property (or {}
 *         if no object found at that property)..
 */
const createHtmlPanelModelObject = function( parentVMO, propName ) {
    let propHtmlPanelObj;

    if( parentVMO && parentVMO.props[ propName ] && !_.isEmpty( parentVMO.props[ propName ].dbValue ) ) {
        let propModelObj = cdm.getObject( parentVMO.props[ propName ].dbValue );

        if( propModelObj ) {
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( propModelObj );

            propHtmlPanelObj = xrtHtmlPanelSvc.createHtmlPanelModelObjectOverlay( vmo );
        } else {
            propHtmlPanelObj = {};
        }
    } else {
        propHtmlPanelObj = {};
    }

    return propHtmlPanelObj;
};

export const initialize = ( props ) => {
    const { enableResizeCallback, htmlpaneldata } = props;
    if( !htmlpaneldata ) {
        return;
    }
    const { enableresize } = htmlpaneldata;
    addContainerResizeCSS( enableResizeCallback, enableresize );
};

export const onUnmount = ( props, getViewModelCollection ) => {
    const { enableResizeCallback, htmlpaneldata, subPanelContext } = props;
    if( !htmlpaneldata ) {
        return;
    }
    const { enableresize, declarativeKey } = htmlpaneldata;
    cleanUpResizeCSS( enableResizeCallback, enableresize );

    if( getViewModelCollection && props.dpRef && props.dpRef.current && props.dpRef.current.includes( getViewModelCollection ) ) {
        let index = props.dpRef.current.indexOf( getViewModelCollection );
        if( index > -1 ) {
            props.dpRef.current.splice( getViewModelCollection, 1 );
        }
    }

    if( subPanelContext && subPanelContext.editHandler ) {
        let dataSource = subPanelContext.editHandler.getDataSource();
        if ( dataSource ) {
            let newViewModel = { ...dataSource.getDeclViewModel() };

            if( newViewModel.customPanelInfo && declarativeKey && newViewModel.customPanelInfo[ declarativeKey ] ) {
                delete newViewModel.customPanelInfo[ declarativeKey ];
                let newDataSource = dataSourceService.createNewDataSource( { declViewModel: newViewModel } );
                subPanelContext.editHandler.setDataSource( newDataSource );
            }
        }
    }
};

export const awWalkerHtmlPanelRenderFunction = ( props ) => {
    const { ctx, htmlpaneldata, subPanelContext, xrtState, elementRefList,
        type, selectionData, dpRef, viewModel, vmo, caption } = props;

    if( !htmlpaneldata ) {
        return;
    }

    const { enableresize, src, declarativeKey } = htmlpaneldata;
    const { userSession } = ctx;
    const userSessionHPMO = xrtHtmlPanelSvc.createHtmlPanelModelObjectOverlay( userSession );
    const userHPMO = createHtmlPanelModelObject( userSession, 'user' );
    const groupHPMO = createHtmlPanelModelObject( userSession, 'group' );
    const roleHPMO = createHtmlPanelModelObject( userSession, 'role' );
    const projectHPMO = createHtmlPanelModelObject( userSession, 'project' );
    const panelRef = elementRefList.get( 'panelRef' );
    const selectedVMO = vmo;

    const updateVMCollectionCallback = function( response ) {
        if( response && response.dataProvider && dpRef ) {
            if( !dpRef.current ) {
                dpRef.current = {
                    dataProviders: []
                };
            }

            let index = dpRef.current.dataProviders.indexOf( response.dataProvider.viewModelCollection.getLoadedViewModelObjects );
            if( index === -1 ) {
                dpRef.current.dataProviders.push( response.dataProvider.viewModelCollection.getLoadedViewModelObjects );
                viewModel.dispatch( { path: 'data.getViewModelCollection', value: response.dataProvider.viewModelCollection.getLoadedViewModelObjects } );
            }
        }
    };

    let vmProps = {};
    if( xrtState.xrtVMO && xrtState.xrtVMO.props ) {
        vmProps = xrtState.xrtVMO.props;
    }

    // Session info needs to be fields not viewModelProperties and support this format: session.current_group.properties.object_string
    const htmlPanelDataCtx = {
        session: {
            current_user_session: userSessionHPMO,
            current_user: userHPMO,
            current_group: groupHPMO,
            current_role: roleHPMO,
            current_project: projectHPMO
        },
        selected: selectedVMO,
        fields: {
            subPanelContext: {
                ...vmProps
            },
            selected: {
                properties: vmProps
            }
        },
        ...subPanelContext,
        selectionData: selectionData,
        callback: {
            updateVMCollectionCallback
        },
        parentRef: panelRef,
        xrtType: type,
        xrtState,
        caption:caption
    };

    let htmlPanelClassName = 'aw-xrtjs-htmlPanelContainer';

    if( enableresize ) {
        htmlPanelClassName += ' h-12';
    }

    if( src ) {
        return <div className={htmlPanelClassName}>
            <div className='aw-jswidgets-htmlPanel'>
                <div className='aw-jswidgets-htmlPanelFrame aw-xrt-columnContentPanel'><AwFrame url={src}></AwFrame></div>
            </div>
        </div>;
    } else if( declarativeKey ) {
        if( xrtState && xrtState.xrtVMO && xrtState.xrtVMO.uid ) {
            return <div className={htmlPanelClassName} ref={ panelRef }>
                <div className='aw-jswidgets-htmlPanel'>
                    <AwInclude key={xrtState.xrtVMO.uid} className='aw-jswidgets-declarativeKeyCont' subPanelContext={htmlPanelDataCtx} name={declarativeKey}></AwInclude>
                </div>
            </div>;
        }
        return <div className={htmlPanelClassName} ref={ panelRef }>
            <div className='aw-jswidgets-htmlPanel'>
                <AwInclude className='aw-jswidgets-declarativeKeyCont' subPanelContext={htmlPanelDataCtx} name={declarativeKey}></AwInclude>
            </div>
        </div>;
    }
};
