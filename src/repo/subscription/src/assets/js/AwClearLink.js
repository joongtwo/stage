import AwLink from 'viewmodel/AwLinkViewModel';

export const AwClearLink = ( props ) => {
    const {
        actions,
        fields,
        ...prop
    } = props;

    return (
        <div>
            <div className='aw-layout-flexRow'>
                <AwLink className='clearLink aw-layout-justifyFlexEnd aw-notificationAlert-appHeader' action={actions.clearMessages} {...fields.clearLink}></AwLink>
            </div>
        </div>
    );
};

