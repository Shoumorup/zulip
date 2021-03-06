var invite = (function () {

var exports = {};

function reset_error_messages() {
    var invite_status = $('#invite_status');
    var invitee_emails = $("#invitee_emails");
    var invitee_emails_group = invitee_emails.closest('.control-group');

    invite_status.hide().text('').removeClass('alert-error alert-warning alert-success');
    invitee_emails_group.removeClass('warning error');
    if (page_params.development_environment) {
        $('#dev_env_msg').hide().text('').removeClass('alert-error alert-warning alert-success');
    }
}

function get_common_invitation_data() {
    var invite_as = parseInt($('#invite_as').val(), 10);
    var stream_ids = [];
    $("#invite-stream-checkboxes input:checked").each(function () {
        var stream_id = parseInt($(this).val(), 10);
        stream_ids.push(stream_id);
    });
    var data = {
        csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]').attr('value'),
        invite_as: invite_as,
        stream_ids: JSON.stringify(stream_ids),
    };
    return data;
}

function submit_invitation_form() {
    var invite_status = $('#invite_status');
    var invitee_emails = $("#invitee_emails");
    var invitee_emails_group = invitee_emails.closest('.control-group');
    var data = get_common_invitation_data();
    data.invitee_emails = $("#invitee_emails").val();

    channel.post({
        url: "/json/invites",
        data: data,
        beforeSubmit: function () {
            reset_error_messages();
            // TODO: You could alternatively parse the textarea here, and return errors to
            // the user if they don't match certain constraints (i.e. not real email addresses,
            // aren't in the right domain, etc.)
            //
            // OR, you could just let the server do it. Probably my temptation.
            $('#submit-invitation').button('loading');
            return true;
        },
        success: function () {
            $('#submit-invitation').button('reset');
            ui_report.success(i18n.t('User(s) invited successfully.'), invite_status);
            invitee_emails_group.removeClass('warning');
            invitee_emails.val('');

            if (page_params.development_environment) {
                var rendered_email_msg = templates.render('dev_env_email_access');
                $('#dev_env_msg').html(rendered_email_msg).addClass('alert-info').show();
            }

        },
        error: function (xhr) {
            $('#submit-invitation').button('reset');
            var arr = JSON.parse(xhr.responseText);
            if (arr.errors === undefined) {
                // There was a fatal error, no partial processing occurred.
                ui_report.error("", xhr, invite_status);
            } else {
                // Some users were not invited.
                var invitee_emails_errored = [];
                var error_list = [];
                arr.errors.forEach(function (value) {
                    error_list.push(value.join(': '));
                    invitee_emails_errored.push(value[0]);
                });

                var error_response = templates.render("invitation_failed_error", {
                    error_message: arr.msg,
                    error_list: error_list,
                });
                ui_report.message(error_response, invite_status, "alert-warning");
                invitee_emails_group.addClass('warning');

                if (arr.sent_invitations) {
                    invitee_emails.val(invitee_emails_errored.join('\n'));
                }

            }

        },
    });
}

exports.get_invite_streams = function () {
    var streams = _.filter(stream_data.get_invite_stream_data(), function (stream) {
        var is_notifications_stream = stream.name === page_params.notifications_stream;
        // You can't actually elect to invite someone to the
        // notifications stream. We won't even show it as a choice unless
        // it's the only stream you have, or if you've made it private.
        return stream_data.subscribed_streams().length === 1 ||
            !is_notifications_stream ||
            is_notifications_stream && stream.is_invite_only;
    });
    return streams;
};

function update_subscription_checkboxes() {
    var data = {streams: exports.get_invite_streams()};
    var html = templates.render('invite_subscription', data);
    $('#streams_to_add').html(html);
}

function prepare_form_to_be_shown() {
    update_subscription_checkboxes();
    reset_error_messages();
}

exports.launch = function () {
    ui.set_up_scrollbar($("#invite_user_form .modal-body"));

    $('#submit-invitation').button();
    prepare_form_to_be_shown();
    $("#invitee_emails").focus().autosize();

    overlays.open_overlay({
        name: 'invite',
        overlay: $('#invite-user'),
        on_close: function () {
            hashchange.exit_overlay();
        },
    });
};

exports.initialize = function () {
    $(document).on('click', '.invite_check_all_button', function (e) {
        $('#streams_to_add :checkbox').prop('checked', true);
        e.preventDefault();
    });

    $(document).on('click', '.invite_uncheck_all_button', function (e) {
        $('#streams_to_add :checkbox').prop('checked', false);
        e.preventDefault();
    });

    $("#submit-invitation").on("click", submit_invitation_form);
};

return exports;

}());

if (typeof module !== 'undefined') {
    module.exports = invite;
}
window.invite = invite;
