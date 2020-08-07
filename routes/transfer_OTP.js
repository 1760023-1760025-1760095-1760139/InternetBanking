const {Router}=require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler=require('express-async-handler');
const Transfer=require('../services/transfer');
const User=require('../services/user');
const Bank=require('../services/bank');
const Account=require('../services/account');
const Email=require('../services/email');
const Notification=require('../services/notification');
const Interest_rate = require('../services/interest_rate');
const Account_saving = require('../services/account_saving');
const router = new Router();

var errors=[];
var time_day=0;
router.get('/',asyncHandler(async function (req,res){
    const user= await User.findById(req.session.userId);
    const bank_user=await Bank.findByCode(user.bank);
    const account_saving=await Account_saving.findBySTK(req.session.userId);
    if(req.session.userId){
        if(user.staff==true){
            return res.redirect('/staff');
        }
        if(user.authentication!=null){
            req.session.id=req.session.userId;
            delete req.session.userId;
            return res.redirect('/login_authentication');
        }
        if(user.lock==true){
            delete req.session.userId;
            return res.redirect('login_locked_account');
        }
        if(account_saving){
            time_day=await Interest_rate.sum_day(req.session.userId);
        }
        if(req.session.idTransfer){
            return res.render('transfer_OTP',{errors,bank,time_day,account_saving});
        }
        return res.redirect('/transfer');
    }
    else {
        return res.redirect('/login');
    }
}));

router.post('/',asyncHandler(async function (req,res){
    errors = validationResult(req);
    const user= await User.findById(req.session.userId);
    const bank_user=await Bank.findByCode(user.bank);
    const account_saving=await Account_saving.findBySTK(req.session.userId);
    if(user.authentication!=null){
        req.session.id=req.session.userId;
        delete req.session.userId;
        return res.redirect('/login_authentication');
    }
    if(user.lock==true){
        delete req.session.userId;
        return res.redirect('login_locked_account');
    }
    if (!errors.isEmpty()) {
        errors = errors.array();
        return res.render('transfer_OTP', {errors,bank,time_day,account_saving});
    }
    errors = [];

    const transfer = await Transfer.findById(req.session.idTransfer);
    if(transfer && (req.body.OTP===transfer.OTP)){
        transfer.OTP=null;//xét = null thì ms xuất qua staff
        transfer.save();

        //truy vấn thông tn ng gửi
        const acc= await Account.findById(transfer.STK_acc);
        const user_acc= await User.findById(transfer.STK_acc);
        const bank_acc= await Bank.findByCode(user_acc.bank);

        //truy vấn thông tn ng nhận
        const acc_rec= await Account.findById(transfer.STK);
        const user_rec= await User.findById(transfer.STK);
        const bank_rec= await Bank.findByCode(user_rec.bank);

        if(transfer.currency_unit=="VND"){
            
            //khoản tiền gửi sẽ bị trừ vào tk ng gửi
            acc.money=acc.money-transfer.money-transfer.tax;
            acc.save();

            //gửi email báo số dư cho ng gửi
            Email.send(user_acc.email,'Thay đổi số dư tài khoản',`Số dư tài khoản vừa giảm ${transfer.money} VND vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc.money} VND và ${acc.money_USD} USD. \n
                Mô tả: ${transfer.description}. \n
                Gửi cho số tài hoản ${transfer.STK} của ngân hàng ${bank_rec.Name}. \n
                Tên người nhận ${user_rec.displayName}.\n
                Số tiền: ${transfer.money} VND phí ${transfer.tax} VND.`);

            var string=`Số dư tài khoản vừa giảm ${transfer.money} VND vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc.money} VND và ${acc.money_USD} USD. \n
                Mô tả: ${transfer.description}. \n
                Gửi cho số tài hoản ${transfer.STK} của ngân hàng ${bank_rec.Name}. \n
                Tên người nhận ${user_rec.displayName}.\n
                Số tiền: ${transfer.money} VND phí ${transfer.tax} VND.`;

            var today = new Date();
            var date= today.toISOString();
            var date_name=date.substring(0,10)
            const notification=await Notification.addNotification(user_acc.id,string,date_name);

            //khoản tiền gửi sẽ được cộng vào tk ng nhận
            acc_rec.money=acc_rec.money+transfer.money;
            acc_rec.save();

            //gửi email báo số dư cho ng nhận
            Email.send(user_rec.email,'Thay đổi số dư tài khoản',`Số dư tài khoản vừa tăng ${transfer.money} VND vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc_rec.money} VND. \n
                Mô tả: ${transfer.description}. \n
                Nhận từ số tài hoản ${transfer.STK_acc} của ngân hàng ${bank_acc.Name}. \n
                Tên người gửi ${user_acc.displayName}.\n
                Số tiền: ${transfer.money} VND.`);

            string=`Số dư tài khoản vừa tăng ${transfer.money} VND vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc_rec.money} VND. \n
                Mô tả: ${transfer.description}. \n
                Nhận từ số tài hoản ${transfer.STK_acc} của ngân hàng ${bank_acc.Name}. \n
                Tên người gửi ${user_acc.displayName}.\n
                Số tiền: ${transfer.money} VND.`;
            notification=await Notification.addNotification(user_rec.id,string,date_name);

            delete req.session.idTransfer;
            return res.redirect('/customer');
        }
        else{
            //khoản tiền gửi sẽ bị trừ vào tk ng gửi
            acc.money_USD=acc.money_USD-transfer.money;
            acc.save();

            //gửi email báo số dư cho ng gửi
            Email.send(user_acc.email,'Thay đổi số dư tài khoản',`Số dư tài khoản vừa giảm ${transfer.money} USD vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc.money} VND và ${acc.money_USD} USD. \n
                Mô tả: ${transfer.description}. \n
                Gửi cho số tài hoản ${transfer.STK} của ngân hàng ${bank_rec.Name}. \n
                Tên người nhận ${user_rec.displayName}.\n
                Số tiền: ${transfer.money} USD.`);

            var string=`Số dư tài khoản vừa giảm ${transfer.money} USD vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc.money} VND và ${acc.money_USD} USD. \n
                Mô tả: ${transfer.description}. \n
                Gửi cho số tài hoản ${transfer.STK} của ngân hàng ${bank_rec.Name}. \n
                Tên người nhận ${user_rec.displayName}.\n
                Số tiền: ${transfer.money} USD.`;

            var today = new Date();
            var date= today.toISOString();
            var date_name=date.substring(0,10)
            const notification=await Notification.addNotification(user_acc.id,string,date_name);

            //khoản tiền gửi sẽ được cộng vào tk ng nhận
            acc_rec.money_USD=acc_rec.money_USD+transfer.money;
            acc_rec.save();

            //gửi email báo số dư cho ng nhận
            Email.send(user_rec.email,'Thay đổi số dư tài khoản',`Số dư tài khoản vừa tăng ${transfer.money} USD vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc_rec.money} VND và ${acc_rec.money_USD} USD. \n
                Mô tả: ${transfer.description}. \n
                Nhận từ số tài hoản ${transfer.STK_acc} của ngân hàng ${bank_acc.Name}. \n
                Tên người gửi ${user_acc.displayName}.\n
                Số tiền: ${transfer.money} USD.`);

            string=`Số dư tài khoản vừa tăng ${transfer.money} USD vào ${transfer.createdAt}. \n
                Số dư hiện tại: ${acc_rec.money} VND và ${acc_rec.money_USD} USD. \n
                Mô tả: ${transfer.description}. \n
                Nhận từ số tài hoản ${transfer.STK_acc} của ngân hàng ${bank_acc.Name}. \n
                Tên người gửi ${user_acc.displayName}.\n
                Số tiền: ${transfer.money} USD.`;
            notification=await Notification.addNotification(user_rec.id,string,date_name);

            delete req.session.idTransfer;
            return res.redirect('/customer');
        }        
    }

    errors = [{ msg: "Wrong OTP!!!" }];
    return res.render('transfer_OTP',{errors,bank,time_day,account_saving});
}));

module.exports = router;