import express from 'express';
import cors from 'cors';
import UserServices from './Services/UserServices.js'
import ClientServices from './Services/ClientServices.js'
import HostServices from './Services/HostServices.js'
import AdminServices from './Services/AdminServices.js'
import ComplaintServices from './Services/ComplaintServices.js'
import NotificationServices from './Services/NotificationsService.js'
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/api/users', UserServices);
app.use('/api/client', ClientServices);
app.use('/api/host', HostServices);
app.use('/api/admin', AdminServices);
app.use('/api/complaints', ComplaintServices);
app.use('/api/notifications', NotificationServices)


app.listen(8081, '0.0.0.0', () => {
    console.log("Server started at port: 8081");
});