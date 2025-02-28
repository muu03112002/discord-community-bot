const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');

// ボットのインテント（権限）設定
const client = new Discord.Client();

// 設定ファイルの保存先
const configFolderPath = path.join(__dirname, 'config');
if (!fs.existsSync(configFolderPath)) {
  fs.mkdirSync(configFolderPath, { recursive: true });
}

// ロール設定の保存・読み込み
const getRoleConfigPath = (guildId) => path.join(configFolderPath, `${guildId}_roles.json`);

const saveRoleConfig = (guildId, config) => {
  fs.writeFileSync(getRoleConfigPath(guildId), JSON.stringify(config, null, 2));
};

const loadRoleConfig = (guildId) => {
  const filePath = getRoleConfigPath(guildId);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return { roles: [] };
};

// ボットの準備完了時のイベント
client.once('ready', () => {
  console.log(`準備完了: ${client.user.tag}でログインしました`);
});

// メッセージ受信時のイベント処理
client.on('message', async (message) => {
  // botのメッセージは無視
  if (message.author.bot) return;

  // 管理者権限チェック（コマンド実行者が管理者であることを確認）
  const isAdmin = message.member && message.member.hasPermission('ADMINISTRATOR');

  // setupコマンド処理
  if (message.content.startsWith('!setup') && isAdmin) {
    const args = message.content.split(' ').slice(1);
    
    // ロール設定コマンド
    if (args[0] === 'role') {
      // !setup role <ボタンテキスト> <ロールID>
      if (args.length >= 3) {
        const buttonText = args[1];
        const roleId = args[2];
        
        // ロールが存在するか確認
        const role = message.guild.roles.cache.get(roleId);
        if (!role) {
          return message.reply('指定されたロールが見つかりません。正しいロールIDを指定してください。');
        }
        
        // 設定を保存
        const config = loadRoleConfig(message.guild.id);
        const existingRoleIndex = config.roles.findIndex(r => r.buttonText === buttonText);
        
        if (existingRoleIndex !== -1) {
          config.roles[existingRoleIndex].roleId = roleId;
        } else {
          config.roles.push({ buttonText, roleId });
        }
        
        saveRoleConfig(message.guild.id, config);
        return message.reply(`ボタン「${buttonText}」にロール「${role.name}」を設定しました。`);
      } else {
        return message.reply('使用方法: !setup role <ボタンテキスト> <ロールID>');
      }
    }
    
    // メインのセットアップメニュー
    const setupEmbed = new Discord.MessageEmbed()
      .setTitle('セットアップメニュー')
      .setDescription('セットアップするシステムを選択してください：')
      .setColor('#0099ff');
    
    const msg = await message.channel.send(setupEmbed);
    await msg.react('📱'); // 電話番号認証
    await msg.react('👤'); // ロール選択
    await msg.react('💬'); // メッセージ送信
    await msg.react('🔊'); // ボイスチャンネル
    
    // リアクション収集
    const filter = (reaction, user) => {
      return ['📱', '👤', '💬', '🔊'].includes(reaction.emoji.name) && user.id === message.author.id;
    };
    
    msg.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
      .then(async collected => {
        const reaction = collected.first();
        
        if (reaction.emoji.name === '📱') {
          // 電話番号認証システム
          const embed = new Discord.MessageEmbed()
            .setTitle('🔒 電話番号認証ガイド 🔒')
            .setDescription('ようこそ。\n本サーバーでは、安全性を確保するために電話番号認証をお願いしています。以下の手順に従って認証を行ってください。')
            .addField('⚠️ 注意', '* 電話番号認証はサーバーの安全性を高めるために必須です。\n* 一度認証を行うと、今後は電話番号を変更しない限り再認証の必要はありません。')
            .addField('\u200B', 'ご不明点があれば、運営までお知らせください。')
            .setColor('#0099ff');
          
          const verifyMsg = await message.channel.send(embed);
          await verifyMsg.react('✅');
          
          message.reply('電話番号認証システムをセットアップしました。');
        }
        else if (reaction.emoji.name === '👤') {
          // ロール選択システム
          const embed = new Discord.MessageEmbed()
            .setTitle('🎮 ロール選択 🎮')
            .setDescription('本サーバー内では、プレイヤーに適したロール（役職）を選んでいただく必要があります。以下の手順に従って、希望するロールを選択してください。')
            .addField('1. ロール選択', '下記の絵文字から自分に合ったロールを選んでください。選択したロールに応じて、サーバー内でのアクセス権や役割が決まります。複数選択可能です。')
            .addField('2. 変更・解除', 'ロールは後から変更することも可能です。解除したい場合は同じ絵文字を再度押してください。')
            .addField('\u200B', 'ご不明な点があれば運営にお知らせください。')
            .setColor('#00ff00');
          
          // 保存されているロール設定を読み込む
          const config = loadRoleConfig(message.guild.id);
          const roleMsg = await message.channel.send(embed);
          
          // 設定されたロールがない場合
          if (config.roles.length === 0) {
            message.reply('ロールが設定されていません。`!setup role <ボタンテキスト> <ロールID>`でロールを設定してください。');
            return;
          }
          
          // 各ロールに対応する絵文字を設定
          const emojis = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪', '⚫', '🟤'];
          const roleEmojis = {};
          
          for (let i = 0; i < Math.min(config.roles.length, emojis.length); i++) {
            roleEmojis[emojis[i]] = config.roles[i].roleId;
            await roleMsg.react(emojis[i]);
            
            // ロール説明を追加
            const role = message.guild.roles.cache.get(config.roles[i].roleId);
            if (role) {
              embed.addField(`${emojis[i]} ${config.roles[i].buttonText}`, `ロール: ${role.name}`, true);
            }
          }
          
          // 更新された説明で置き換え
          await roleMsg.edit(embed);
          
          message.reply('ロール選択システムをセットアップしました。');
        }
        else if (reaction.emoji.name === '💬') {
          // メッセージ送信システム
          message.reply('送信したいメッセージを入力してください。入力後に送信します。');
          
          const messageFilter = m => m.author.id === message.author.id && !m.author.bot;
          message.channel.awaitMessages(messageFilter, { max: 1, time: 300000, errors: ['time'] })
            .then(collected => {
              const msg = collected.first();
              message.channel.send(msg.content);
              message.reply('メッセージを送信しました。');
            })
            .catch(() => {
              message.reply('タイムアウトしました。もう一度お試しください。');
            });
        }
        else if (reaction.emoji.name === '🔊') {
          // ボイスチャンネル作成システム
          const embed = new Discord.MessageEmbed()
            .setTitle('🔊 ボイスチャンネル作成システム 🔊')
            .setDescription('以下の絵文字をクリックして、一時的なボイスチャンネルを作成できます。')
            .addField('使い方', '1. 「🎙️」絵文字をクリックします\n2. チャンネル名を入力します\n3. 作成されたチャンネルに10秒以内に参加してください\n4. チャンネル内の全メンバーが退出すると、10秒後に自動的に削除されます')
            .setColor('#ff0000');
          
          const vcMsg = await message.channel.send(embed);
          await vcMsg.react('🎙️');
          
          message.reply('ボイスチャンネル作成システムをセットアップしました。');
        }
      })
      .catch(() => {
        message.reply('タイムアウトしました。もう一度お試しください。');
      });
  }
});

// リアクションイベント処理
client.on('messageReactionAdd', async (reaction, user) => {
  // ボットのリアクションは無視
  if (user.bot) return;
  
  // 部分的に取得したリアクションの場合、完全なものを取得
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('リアクションの取得中にエラーが発生しました:', error);
      return;
    }
  }
  
  const { message } = reaction;
  const guild = message.guild;
  
  // 電話番号認証
  if (reaction.emoji.name === '✅' && message.embeds[0] && message.embeds[0].title === '🔒 電話番号認証ガイド 🔒') {
    user.send('Discordの電話番号認証ガイドに従って認証を行ってください：\n1. Discordの設定を開きます\n2. アカウント設定から「電話番号」を選択します\n3. 画面の指示に従って電話番号を登録します\n4. 認証コードを入力して認証完了\n\n※このプロセスはDiscordの公式機能を使用します。botは電話番号を収集しません。');
  }
  
  // ロール選択
  const config = loadRoleConfig(guild.id);
  const emojis = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪', '⚫', '🟤'];
  const emojiIndex = emojis.indexOf(reaction.emoji.name);
  
  if (emojiIndex !== -1 && emojiIndex < config.roles.length && message.embeds[0] && message.embeds[0].title === '🎮 ロール選択 🎮') {
    const roleId = config.roles[emojiIndex].roleId;
    const role = guild.roles.cache.get(roleId);
    const member = await guild.members.fetch(user.id);
    
    if (!role) {
      user.send('指定されたロールが見つかりません。管理者に連絡してください。');
      return;
    }
    
    // ロールの付与・解除を切り替え
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      user.send(`ロール「${role.name}」を解除しました。`);
    } else {
      await member.roles.add(roleId);
      user.send(`ロール「${role.name}」を付与しました。`);
    }
    
    // リアクションを削除（ユーザーがもう一度クリックできるように）
    reaction.users.remove(user);
  }
  
  // ボイスチャンネル作成
  if (reaction.emoji.name === '🎙️' && message.embeds[0] && message.embeds[0].title === '🔊 ボイスチャンネル作成システム 🔊') {
    user.send('作成するボイスチャンネルの名前を入力してください。');
    
    const dmChannel = await user.createDM();
    const filter = m => !m.author.bot;
    
    dmChannel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] })
      .then(async collected => {
        const channelName = collected.first().content;
        
        try {
          // カテゴリーを取得（または作成）
          let category = guild.channels.cache.find(c => c.name === '一時的なボイスチャンネル' && c.type === 'category');
          
          if (!category) {
            category = await guild.channels.create('一時的なボイスチャンネル', {
              type: 'category'
            });
          }
          
          // ボイスチャンネル作成
          const voiceChannel = await guild.channels.create(channelName, {
            type: 'voice',
            parent: category.id
          });
          
          user.send(`ボイスチャンネル「${channelName}」を作成しました。10秒以内に参加してください。`);
          
          // 10秒後にチェック
          setTimeout(async () => {
            try {
              // チャンネルが存在するか確認
              const updatedChannel = guild.channels.cache.get(voiceChannel.id);
              if (!updatedChannel) return;
              
              // メンバーがいなければ削除
              if (updatedChannel.members.size === 0) {
                await updatedChannel.delete('自動削除: 10秒以内に誰も参加しませんでした');
                user.send(`ボイスチャンネル「${channelName}」は10秒以内に誰も参加しなかったため削除されました。`);
              }
            } catch (error) {
              console.error('チャンネル確認中にエラーが発生しました:', error);
            }
          }, 10000);
          
        } catch (error) {
          console.error('ボイスチャンネル作成中にエラーが発生しました:', error);
          user.send('ボイスチャンネルの作成中にエラーが発生しました。権限を確認してください。');
        }
      })
      .catch(() => {
        user.send('タイムアウトしました。もう一度お試しください。');
      });
    
    // リアクションを削除（ユーザーがもう一度クリックできるように）
    reaction.users.remove(user);
  }
});

// ボイスチャンネルの状態変更イベント
client.on('voiceStateUpdate', async (oldState, newState) => {
  // ユーザーがボイスチャンネルから退出した場合
  if (oldState.channel && !newState.channel) {
    const channel = oldState.channel;
    
    // チャンネルが存在し、カテゴリーが「一時的なボイスチャンネル」である場合
    if (channel && channel.parent && channel.parent.name === '一時的なボイスチャンネル') {
      // チャンネル内のメンバーがいないかチェック
      if (channel.members.size === 0) {
        // 10秒待ってから再度確認
        setTimeout(async () => {
          try {
            // チャンネルが存在するか確認
            const updatedChannel = oldState.guild.channels.cache.get(channel.id);
            if (!updatedChannel) return;
            
            // メンバーがいなければ削除
            if (updatedChannel.members.size === 0) {
              await updatedChannel.delete('自動削除: 全メンバーが退出してから10秒経過');
            }
          } catch (error) {
            console.error('チャンネル削除中にエラーが発生しました:', error);
          }
        }, 10000);
      }
    }
  }
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('エラーが発生しました:', error);
});

// ボットにログインする
client.login(process.env.DISCORD_TOKEN);
