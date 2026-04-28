const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

// اسم القناة في Kick
const CHANNEL_NAME = 've-0'; 

// دمج البيانات من Kick وتخطي حماية Cloudflare بذكاء
app.get('/api/channel', async (req, res) => {
    let channelData = { followers_count: 0, livestream: null };

    // قائمة وسطاء (Proxies) مخصصة لكسر الحماية وتخطي الـ CORS
    const proxyList = [
        `https://corsproxy.io/?https://kick.com/api/v2/channels/${CHANNEL_NAME}`,
        `https://api.allorigins.win/raw?url=https://kick.com/api/v2/channels/${CHANNEL_NAME}?t=${Date.now()}`
    ];

    for (let proxyUrl of proxyList) {
        try {
            const response = await axios.get(proxyUrl, {
                headers: { 
                    // تمويه الطلب ليبدو وكأنه من متصفح حقيقي
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' 
                },
                timeout: 6000 // ننتظر 6 ثواني كحد أقصى
            });
            
            // إذا استلمنا بيانات صحيحة وفيها عدد المتابعين
            if (response.data && response.data.followers_count !== undefined) {
                channelData.followers_count = response.data.followers_count;
                
                // إذا كان البث شغال، نسحب كائن الـ livestream
                if (response.data.livestream) {
                    channelData.livestream = response.data.livestream;
                }
                
                console.log(`✅ تم جلب البيانات بنجاح! المتابعين: ${channelData.followers_count}`);
                return res.json(channelData); // نرسل البيانات للموقع ونوقف البحث
            }
        } catch (e) {
            console.log(`⚠️ فشل أحد الوسطاء، جاري تجربة طريقة أخرى...`);
        }
    }

    // إرسال البيانات (حتى لو كانت صفر) لتجنب انهيار الموقع
    res.json(channelData);
});

// جلب الكليبات باستخدام البروكسي
app.get('/api/clips', async (req, res) => {
    try {
        const response = await axios.get(`https://corsproxy.io/?https://kick.com/api/v2/channels/${CHANNEL_NAME}/clips`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        res.json(response.data);
    } catch (error) {
        try {
            // محاولة بديلة إذا فشل الأول
            const fallbackRes = await axios.get(`https://api.allorigins.win/raw?url=https://kick.com/api/v2/channels/${CHANNEL_NAME}/clips`);
            res.json(fallbackRes.data);
        } catch(e) {
            res.status(500).json({ error: "Failed to fetch clips" });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر شغال ومستعد لكسر الحماية على البورت ${PORT}`);
});